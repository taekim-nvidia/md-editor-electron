import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { execFile, execFileSync } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'

const execFileAsync = promisify(execFile)
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

const GH_WORKSPACE = process.platform === 'win32'
  ? path.join(process.env.TEMP ?? 'C:\\Temp', 'gh-workspace')
  : '/tmp/gh-workspace'

if (!fs.existsSync(GH_WORKSPACE)) {
  fs.mkdirSync(GH_WORKSPACE, { recursive: true })
}

// ── Git identity from gh ──────────────────────────────────────────────────────

async function ensureGitIdentity() {
  try {
    // Check if already set
    try {
      const name  = execFileSync('git', ['config', '--global', 'user.name'],  { encoding: 'utf8' }).trim()
      const email = execFileSync('git', ['config', '--global', 'user.email'], { encoding: 'utf8' }).trim()
      if (name && email) {
        console.log(`[git] identity already set: ${name} <${email}>`)
        return
      }
    } catch (_) {}

    // Pull from gh
    const { stdout } = await execFileAsync('gh', ['api', 'user', '--jq', '.login + "\\n" + (.name // .login)'])
    const parts = stdout.trim().split('\n')
    const login = parts[0]
    const name  = parts[1] || parts[0]
    const email = `${login}@users.noreply.github.com`

    execFileSync('git', ['config', '--global', 'user.name',  name])
    execFileSync('git', ['config', '--global', 'user.email', email])
    console.log(`[git] identity configured: ${name} <${email}>`)
  } catch (e) {
    console.warn('[git] could not configure identity:', e)
  }
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

  // Lock visual zoom — our app handles font size internally
  win.webContents.setVisualZoomLevelLimits(1, 1)
  win.webContents.setZoomFactor(1.0)
  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(1.0))

  if (isDev) {
    win.loadURL('http://localhost:5173')
    // DevTools disabled by default — pass --devtools flag to enable
    if (process.argv.includes('--devtools')) {
      win.webContents.openDevTools()
    }
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  // Custom menu without zoom shortcuts
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
      { role: 'togglefullscreen' },
    ]},
    { label: 'Window', submenu: [
      { role: 'minimize' }, { role: 'zoom' }, { role: 'close' },
    ]},
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  await ensureGitIdentity()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC: git ──────────────────────────────────────────────────────────────────

ipcMain.handle('git:run', async (_event, args: string[], cwd: string) => {
  console.log('[git:run]', args, 'in:', cwd)
  try {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd })
    console.log('[git:run] ok:', stdout || stderr)
    return { ok: true, stdout, stderr }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    const errMsg = (e.stderr || e.stdout || e.message || String(err)).trim()
    console.error('[git:run] FAILED:', errMsg)
    // "nothing to commit" is not a real error — treat as ok
    if (errMsg.includes('nothing to commit') || errMsg.includes('nothing added to commit')) {
      return { ok: true, stdout: e.stdout ?? '', stderr: errMsg }
    }
    // Show native dialog for real errors
    const win = BrowserWindow.getFocusedWindow()
    if (win) dialog.showErrorBox('Git Error', `git ${args.join(' ')}\n\n${errMsg}`)
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

// ── IPC: gh clone ─────────────────────────────────────────────────────────────

ipcMain.handle('gh:clone', async (_event, nameWithOwner: string) => {
  const repoName = nameWithOwner.split('/').pop() ?? nameWithOwner.replace('/', '_')
  const destPath = path.join(GH_WORKSPACE, repoName)
  try {
    if (fs.existsSync(destPath)) {
      const { stdout, stderr } = await execFileAsync('git', ['pull'], { cwd: destPath })
      return { ok: true, path: destPath, output: stdout + stderr, action: 'pulled' }
    } else {
      const { stdout, stderr } = await execFileAsync(
        'gh', ['repo', 'clone', nameWithOwner, destPath], { timeout: 60000 }
      )
      return { ok: true, path: destPath, output: stdout + stderr, action: 'cloned' }
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    return { ok: false, error: e.stderr ?? e.message ?? String(err) }
  }
})

// ── IPC: file I/O ─────────────────────────────────────────────────────────────

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
    .map((e) => ({ name: e.name, isDir: e.isDirectory(), path: path.join(dirPath, e.name) }))
    .sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)))
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

// ── IPC: fetch URL ────────────────────────────────────────────────────────────

ipcMain.handle('fetch:url', async (_event, url: string) => {
  // Detect GitHub repo/blob URLs and use gh CLI for private repo support
  const ghRepo = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/)
  const ghBlob = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/)
  const ghTree = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/?$/)

  if (ghBlob) {
    // Specific file — use gh api to get raw content (works for private repos)
    const [, owner, repo, branch, filePath] = ghBlob
    try {
      const apiPath = `repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`
      const { stdout } = await execFileAsync('gh', ['api', apiPath, '--jq', '.content'], { timeout: 15000 })
      const content = Buffer.from(stdout.trim(), 'base64').toString('utf8')
      return { ok: true, content, url }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }

  if (ghRepo || ghTree) {
    // Repo root or tree — fetch README via gh api
    const match = (ghRepo || ghTree)!
    const [, owner, repo, branch] = match
    const ref = branch || 'HEAD'
    for (const readmeName of ['README.md', 'readme.md', 'README.markdown']) {
      try {
        const apiPath = `repos/${owner}/${repo}/contents/${readmeName}?ref=${ref}`
        const { stdout } = await execFileAsync('gh', ['api', apiPath, '--jq', '.content'], { timeout: 15000 })
        const content = Buffer.from(stdout.trim(), 'base64').toString('utf8')
        return { ok: true, content, url }
      } catch (_) {}
    }
    return { ok: false, error: 'No README found in repo' }
  }

  // Non-GitHub URL — plain HTTP fetch
  return new Promise<{ ok: boolean; content?: string; url?: string; error?: string }>((resolve) => {
    const doGet = (u: string, redirectsLeft = 3) => {
      const protocol = u.startsWith('https') ? https : http
      protocol.get(u, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && redirectsLeft > 0) {
          doGet(res.headers.location, redirectsLeft - 1)
          return
        }
        if (res.statusCode !== 200) { resolve({ ok: false, error: `HTTP ${res.statusCode}` }); return }
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve({ ok: true, content: data, url: u }))
      }).on('error', (e) => resolve({ ok: false, error: e.message }))
    }
    doGet(url)
  })
})
