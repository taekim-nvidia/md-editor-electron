import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'

const execFileAsync = promisify(execFile)
const isDev = !app.isPackaged

const GH_WORKSPACE = '/tmp/gh-workspace'

if (!fs.existsSync(GH_WORKSPACE)) {
  fs.mkdirSync(GH_WORKSPACE, { recursive: true })
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1.0,
    },
  })

  // Lock visual zoom to 1 — our app handles font size internally
  win.webContents.setVisualZoomLevelLimits(1, 1)
  win.webContents.setZoomFactor(1.0)
  // Re-lock after any navigation
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1.0)
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    // DevTools only when explicitly requested: Ctrl+Shift+I or --devtools flag
    win.webContents.openDevTools()  // temp: always open for debugging
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ensureGitIdentity()
  // Custom menu — removes default zoom shortcuts (Ctrl+/-)
  // so our font size controls work correctly
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        // Intentionally omit zoom in/out — handled by our app
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC: git ──────────────────────────────────────────────────────────────────

// ── Auto-configure git identity from gh ──────────────────────────────────────
async function ensureGitIdentity() {
  try {
    const { execSync } = require('child_process')
    try {
      const name  = execSync('git config --global user.name',  { encoding: 'utf8' }).trim()
      const email = execSync('git config --global user.email', { encoding: 'utf8' }).trim()
      if (name && email) return
    } catch (_) {}
    const { stdout } = await execFileAsync('gh', ['api', 'user', '--jq', '.login + "\n" + (.name // .login)'])
    const [login, name] = stdout.trim().split('\n')
    const email = `${login}@users.noreply.github.com`
    const { execSync: es } = require('child_process')
    es(`git config --global user.name "${name || login}"`)
    es(`git config --global user.email "${email}"`)
    console.log(`[git] identity set: ${name || login} <${email}>`)
  } catch (e) {
    console.warn('[git] could not auto-configure identity:', e)
  }
}

ipcMain.handle('git:run', async (_event, args: string[], cwd: string) => {
  console.log('[git:run]', args, 'cwd:', cwd)
  try {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd })
    console.log('[git:run] ok stdout:', stdout, 'stderr:', stderr)
    return { ok: true, stdout, stderr }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    const errMsg = e.stderr ?? e.stdout ?? e.message ?? String(err)
    console.error('[git:run] FAILED args:', args, 'error:', errMsg)
    // Show native dialog so error is impossible to miss
    const { dialog, BrowserWindow } = require('electron')
    const win = BrowserWindow.getFocusedWindow()
    if (win) dialog.showErrorBox('Git Error', `Command: git ${args.join(' ')}\n\nError:\n${errMsg}`)
    return { ok: false, stdout: e.stdout ?? '', stderr: errMsg }
  }
})

// ── IPC: gh ───────────────────────────────────────────────────────────────────

ipcMain.handle('gh:run', async (_event, args: string[]) => {
  try {
    const { stdout, stderr } = await execFileAsync('gh', args, { timeout: 60000 })
    return { ok: true, stdout, stderr }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? e.message ?? String(err) }
  }
})

// ── IPC: gh clone (atomic check + clone/pull) ─────────────────────────────────

ipcMain.handle('gh:clone', async (_event, nameWithOwner: string) => {
  const repoName = nameWithOwner.split('/').pop() ?? nameWithOwner.replace('/', '_')
  const destPath = path.join(GH_WORKSPACE, repoName)
  try {
    if (fs.existsSync(destPath)) {
      const { stdout, stderr } = await execFileAsync('git', ['pull'], { cwd: destPath })
      return { ok: true, path: destPath, output: stdout + stderr, action: 'pulled' }
    } else {
      const { stdout, stderr } = await execFileAsync(
        'gh', ['repo', 'clone', nameWithOwner, destPath],
        { timeout: 60000 }
      )
      return { ok: true, path: destPath, output: stdout + stderr, action: 'cloned' }
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    return { ok: false, error: e.stderr ?? e.message ?? String(err) }
  }
})

// ── IPC: file read / write ────────────────────────────────────────────────────

ipcMain.handle('file:read', (_event, filePath: string) => {
  return fs.readFileSync(filePath, 'utf8')
})

ipcMain.handle('file:write', (_event, filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
})

// ── IPC: directory listing ────────────────────────────────────────────────────

ipcMain.handle('fs:readdir', (_event, dirPath: string) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  return entries
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => ({
      name: e.name,
      isDir: e.isDirectory(),
      path: path.join(dirPath, e.name),
    }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
})

// ── IPC: dialogs ──────────────────────────────────────────────────────────────

ipcMain.handle('dialog:open', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:save', async (_event, defaultPath: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Text', extensions: ['txt'] },
    ],
  })
  return result.canceled ? null : (result.filePath ?? null)
})

// ── IPC: fetch URL (with GitHub blob → raw redirect) ─────────────────────────

ipcMain.handle('fetch:url', (_event, url: string) => {
  return new Promise<{ ok: boolean; content?: string; url?: string; error?: string }>((resolve) => {
    let fetchUrl = url
    const ghMatch = url.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
    )
    if (ghMatch) {
      const [, owner, repo, branch, filePath] = ghMatch
      fetchUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
    }

    const doGet = (u: string, redirectsLeft = 3) => {
      const protocol = u.startsWith('https') ? https : http
      protocol
        .get(u, (res) => {
          if (
            (res.statusCode === 301 || res.statusCode === 302) &&
            res.headers.location &&
            redirectsLeft > 0
          ) {
            doGet(res.headers.location, redirectsLeft - 1)
            return
          }
          if (res.statusCode !== 200) {
            resolve({ ok: false, error: `HTTP ${res.statusCode}` })
            return
          }
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => resolve({ ok: true, content: data, url: fetchUrl }))
        })
        .on('error', (e) => resolve({ ok: false, error: e.message }))
    }

    doGet(fetchUrl)
  })
})
