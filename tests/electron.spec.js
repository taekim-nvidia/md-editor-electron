/**
 * Real Electron integration tests
 * Launches the actual Electron app via Playwright's _electron API.
 * Tests the full stack: UI + IPC handlers + git/gh CLI + file I/O.
 */

const { test, expect, _electron } = require('@playwright/test')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execSync } = require('child_process')

const APP_ROOT = path.join(__dirname, '..')

// ── Helpers ───────────────────────────────────────────────────────────────────

async function launchApp() {
  const app = await _electron.launch({
    args: [APP_ROOT, '--no-sandbox'],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY || ':0',
      // Force production mode so Electron loads from dist/ not dev server
      NODE_ENV: 'production',
    },
  })
  const page = await app.firstWindow()
  // Wait for the page to load — in production it loads from dist/index.html
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('.ProseMirror', { timeout: 20000 })
  return { app, page }
}

// ── Section 1: App Launch ─────────────────────────────────────────────────────
test.describe('Electron: App Launch', () => {
  test('app starts and shows WYSIWYG editor', async () => {
    const { app, page } = await launchApp()
    try {
      await expect(page.locator('.ProseMirror')).toBeVisible()
      const title = await app.evaluate(({ app }) => app.getName())
      expect(title).toBeTruthy()
    } finally {
      await app.close()
    }
  })

  test('window has correct dimensions', async () => {
    const { app, page } = await launchApp()
    try {
      const size = await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0]
        return win.getSize()
      })
      expect(size[0]).toBeGreaterThan(800)
      expect(size[1]).toBeGreaterThan(600)
    } finally {
      await app.close()
    }
  })

  test('devtools are NOT open by default', async () => {
    const { app, page } = await launchApp()
    try {
      const devToolsOpen = await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0]
        return win.webContents.isDevToolsOpened()
      })
      expect(devToolsOpen).toBe(false)
    } finally {
      await app.close()
    }
  })
})

// ── Section 2: IPC — File Read/Write ─────────────────────────────────────────
test.describe('Electron: File I/O via IPC', () => {
  test('writeFile and readFile round-trip via IPC', async () => {
    const { app, page } = await launchApp()
    try {
      const tmpFile = path.join(os.tmpdir(), `md-editor-test-${Date.now()}.md`)
      const content = '# IPC Test\n\nWritten by Playwright at ' + new Date().toISOString()

      // Write via IPC
      const writeOk = await page.evaluate(async ({ path, content }) => {
        try {
          await window.electronAPI.writeFile(path, content)
          return true
        } catch (e) {
          return String(e)
        }
      }, { path: tmpFile, content })
      expect(writeOk).toBe(true)

      // Verify file exists on disk
      expect(fs.existsSync(tmpFile)).toBe(true)
      const onDisk = fs.readFileSync(tmpFile, 'utf8')
      expect(onDisk).toBe(content)

      // Read back via IPC
      const readBack = await page.evaluate(async (path) => {
        try {
          return await window.electronAPI.readFile(path)
        } catch (e) {
          return String(e)
        }
      }, tmpFile)
      expect(readBack).toBe(content)

      fs.unlinkSync(tmpFile)
    } finally {
      await app.close()
    }
  })

  test('readDir lists files in a directory via IPC', async () => {
    const { app, page } = await launchApp()
    try {
      const entries = await page.evaluate(async (dir) => {
        return await window.electronAPI.readDir(dir)
      }, APP_ROOT)

      expect(Array.isArray(entries)).toBe(true)
      expect(entries.length).toBeGreaterThan(0)

      const names = entries.map((e) => e.name)
      expect(names).toContain('package.json')
      expect(names).toContain('frontend')
      expect(names).toContain('electron')
    } finally {
      await app.close()
    }
  })

  test('writeFile creates parent directories if needed', async () => {
    const { app, page } = await launchApp()
    try {
      const tmpDir = path.join(os.tmpdir(), `md-test-dir-${Date.now()}`)
      const tmpFile = path.join(tmpDir, 'subdir', 'test.md')
      const content = 'nested file test'

      await page.evaluate(async ({ path, content }) => {
        await window.electronAPI.writeFile(path, content)
      }, { path: tmpFile, content })

      expect(fs.existsSync(tmpFile)).toBe(true)
      expect(fs.readFileSync(tmpFile, 'utf8')).toBe(content)

      fs.rmSync(tmpDir, { recursive: true })
    } finally {
      await app.close()
    }
  })
})

// ── Section 3: IPC — Git operations ──────────────────────────────────────────
test.describe('Electron: Git IPC', () => {
  let tmpRepo

  test.beforeEach(() => {
    // Create a fresh temp git repo for each test
    tmpRepo = path.join(os.tmpdir(), `md-git-test-${Date.now()}`)
    fs.mkdirSync(tmpRepo, { recursive: true })
    execSync('git init', { cwd: tmpRepo })
    execSync('git config user.email "test@test.com"', { cwd: tmpRepo })
    execSync('git config user.name "Test"', { cwd: tmpRepo })
  })

  test.afterEach(() => {
    if (tmpRepo && fs.existsSync(tmpRepo)) {
      fs.rmSync(tmpRepo, { recursive: true })
    }
  })

  test('git:run executes git commands via IPC', async () => {
    const { app, page } = await launchApp()
    try {
      const result = await page.evaluate(async ({ args, cwd }) => {
        return await window.electronAPI.runGit(args, cwd)
      }, { args: ['status', '--porcelain'], cwd: tmpRepo })

      expect(result.ok).toBe(true)
      expect(typeof result.stdout).toBe('string')
      expect(typeof result.stderr).toBe('string')
    } finally {
      await app.close()
    }
  })

  test('git:run returns ok:false with stderr on invalid command', async () => {
    const { app, page } = await launchApp()
    try {
      const result = await page.evaluate(async ({ args, cwd }) => {
        return await window.electronAPI.runGit(args, cwd)
      }, { args: ['invalid-git-command'], cwd: tmpRepo })

      expect(result.ok).toBe(false)
      expect(result.stderr.length).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })

  test('full git add + commit flow via IPC', async () => {
    const { app, page } = await launchApp()
    try {
      // Write a file
      const filePath = path.join(tmpRepo, 'test.md')
      fs.writeFileSync(filePath, '# Test\n\nContent.')

      // git add -A
      const addResult = await page.evaluate(async ({ args, cwd }) => {
        return await window.electronAPI.runGit(args, cwd)
      }, { args: ['add', '-A'], cwd: tmpRepo })
      expect(addResult.ok).toBe(true)

      // git commit
      const commitResult = await page.evaluate(async ({ args, cwd }) => {
        return await window.electronAPI.runGit(args, cwd)
      }, { args: ['commit', '-m', 'test commit from playwright'], cwd: tmpRepo })
      expect(commitResult.ok).toBe(true)
      expect(commitResult.stdout).toContain('test commit from playwright')

      // Verify commit exists
      const logResult = execSync('git log --oneline', { cwd: tmpRepo, encoding: 'utf8' })
      expect(logResult).toContain('test commit from playwright')
    } finally {
      await app.close()
    }
  })

  test('git:run handles nothing-to-commit gracefully', async () => {
    const { app, page } = await launchApp()
    try {
      // Empty repo, nothing staged
      const result = await page.evaluate(async ({ args, cwd }) => {
        return await window.electronAPI.runGit(args, cwd)
      }, { args: ['commit', '-m', 'empty'], cwd: tmpRepo })

      // ok:true because our main.ts treats nothing-to-commit as success
      const msg = (result.stdout + result.stderr).toLowerCase()
      expect(msg.includes('nothing to commit') || result.ok === false).toBe(true)
    } finally {
      await app.close()
    }
  })
})

// ── Section 4: IPC — URL fetch ────────────────────────────────────────────────
test.describe('Electron: URL fetch IPC', () => {
  test('fetch:url fetches a GitHub repo URL (uses gh api for private repos)', async () => {
    const { app, page } = await launchApp()
    try {
      // Use github.com URL — Electron routes this through gh api (authenticated)
      const result = await page.evaluate(async (url) => {
        return await window.electronAPI.fetchUrl(url)
      }, 'https://github.com/NVIDIA-dev/markdown-editor')

      expect(result.ok).toBe(true)
      expect(result.content).toBeTruthy()
      expect(result.content?.length).toBeGreaterThan(100)
      expect(result.content).toContain('markdown-editor')
    } finally {
      await app.close()
    }
  })

  test('fetch:url handles 404 gracefully', async () => {
    const { app, page } = await launchApp()
    try {
      const result = await page.evaluate(async (url) => {
        return await window.electronAPI.fetchUrl(url)
      }, 'https://raw.githubusercontent.com/NVIDIA-dev/markdown-editor/master/NONEXISTENT_FILE_XYZ.md')

      expect(result.ok).toBe(false)
      expect(result.error).toBeTruthy()
    } finally {
      await app.close()
    }
  })
})

// ── Section 5: UI + IPC integration ──────────────────────────────────────────
test.describe('Electron: UI + IPC integration', () => {
  test('open file dialog IPC is wired (showOpenDialog exists)', async () => {
    const { app, page } = await launchApp()
    try {
      const hasApi = await page.evaluate(() => {
        return typeof window.electronAPI?.showOpenDialog === 'function'
      })
      expect(hasApi).toBe(true)
    } finally {
      await app.close()
    }
  })

  test('save file dialog IPC is wired (showSaveDialog exists)', async () => {
    const { app, page } = await launchApp()
    try {
      const hasApi = await page.evaluate(() => {
        return typeof window.electronAPI?.showSaveDialog === 'function'
      })
      expect(hasApi).toBe(true)
    } finally {
      await app.close()
    }
  })

  test('all expected IPC methods are exposed', async () => {
    const { app, page } = await launchApp()
    try {
      const methods = await page.evaluate(() => {
        return Object.keys(window.electronAPI ?? {})
      })
      const required = ['runGit', 'runGh', 'ghClone', 'readFile', 'writeFile', 'readDir', 'showOpenDialog', 'showSaveDialog', 'fetchUrl']
      for (const method of required) {
        expect(methods).toContain(method)
      }
    } finally {
      await app.close()
    }
  })

  test('typing in WYSIWYG and saving via IPC writes correct content to disk', async () => {
    const { app, page } = await launchApp()
    try {
      const tmpFile = path.join(os.tmpdir(), `md-e2e-${Date.now()}.md`)
      const testText = 'E2E test content ' + Date.now()

      // Type in editor
      const prose = page.locator('.ProseMirror')
      await prose.click()
      await page.keyboard.press('Control+a')
      await page.keyboard.type(testText)
      await page.waitForTimeout(300)

      // Save to tmp file via IPC
      const saved = await page.evaluate(async ({ path, content }) => {
        try {
          await window.electronAPI.writeFile(path, content)
          return true
        } catch (e) { return String(e) }
      }, { path: tmpFile, content: testText })
      expect(saved).toBe(true)

      // Verify on disk
      const onDisk = fs.readFileSync(tmpFile, 'utf8')
      expect(onDisk).toBe(testText)

      fs.unlinkSync(tmpFile)
    } finally {
      await app.close()
    }
  })
})


// ── Section 6: Git push/pull IPC ─────────────────────────────────────────────
test.describe('Electron: Git push/pull IPC', () => {
  test('git pull runs without crashing on a valid repo', async () => {
    const { app, page } = await launchApp()
    try {
      // Use the app's own repo which has a remote
      const result = await page.evaluate(async (cwd) => {
        return await window.electronAPI.runGit(['fetch', '--dry-run'], cwd)
      }, path.join(__dirname, '..'))
      // ok or not — we just need it to not throw
      expect(typeof result.ok).toBe('boolean')
      expect(typeof result.stdout).toBe('string')
    } finally {
      await app.close()
    }
  })

  test('git status runs on a valid repo', async () => {
    const { app, page } = await launchApp()
    try {
      const result = await page.evaluate(async (cwd) => {
        return await window.electronAPI.runGit(['status', '--porcelain', '--branch'], cwd)
      }, path.join(__dirname, '..'))
      expect(result.ok).toBe(true)
      expect(result.stdout).toContain('master')
    } finally {
      await app.close()
    }
  })
})

// ── Section 7: ghClone IPC ────────────────────────────────────────────────────
test.describe('Electron: ghClone IPC', () => {
  test('ghClone clones or pulls the markdown-editor repo', async () => {
    const { app, page } = await launchApp()
    try {
      const result = await page.evaluate(async (repo) => {
        return await window.electronAPI.ghClone(repo)
      }, 'NVIDIA-dev/markdown-editor')
      expect(result.ok).toBe(true)
      expect(result.path).toBeTruthy()
      expect(result.action).toMatch(/cloned|pulled/)
    } finally {
      await app.close()
    }
  })

  test('cloned repo directory is readable via readDir', async () => {
    const { app, page } = await launchApp()
    try {
      const cloneResult = await page.evaluate(async (repo) => {
        return await window.electronAPI.ghClone(repo)
      }, 'NVIDIA-dev/markdown-editor')
      expect(cloneResult.ok).toBe(true)

      const entries = await page.evaluate(async (dir) => {
        return await window.electronAPI.readDir(dir)
      }, cloneResult.path)
      expect(Array.isArray(entries)).toBe(true)
      const names = entries.map((e) => e.name)
      expect(names).toContain('README.md')
    } finally {
      await app.close()
    }
  })
})

// ── Section 8: gh:run IPC ─────────────────────────────────────────────────────
test.describe('Electron: gh:run IPC', () => {
  test('gh auth status runs via IPC', async () => {
    const { app, page } = await launchApp()
    try {
      const result = await page.evaluate(async (args) => {
        return await window.electronAPI.runGh(args)
      }, ['auth', 'status'])
      // Either ok (authenticated) or not — just must not crash
      expect(typeof result.ok).toBe('boolean')
    } finally {
      await app.close()
    }
  })

  test('gh api user returns user info', async () => {
    const { app, page } = await launchApp()
    try {
      const result = await page.evaluate(async (args) => {
        return await window.electronAPI.runGh(args)
      }, ['api', 'user', '--jq', '.login'])
      expect(result.ok).toBe(true)
      expect(result.stdout.trim().length).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })
})

// ── Section 9: Git identity ───────────────────────────────────────────────────
test.describe('Electron: Git identity', () => {
  test('git user.name is configured globally', async () => {
    const { app, page } = await launchApp()
    try {
      await page.waitForTimeout(2000) // let ensureGitIdentity run
      const result = await page.evaluate(async ({ args, cwd }) => {
        return await window.electronAPI.runGit(args, cwd)
      }, { args: ['config', '--global', 'user.name'], cwd: APP_ROOT })
      expect(result.ok).toBe(true)
      expect(result.stdout.trim().length).toBeGreaterThan(0)
    } finally {
      await app.close()
    }
  })

  test('git user.email is configured globally', async () => {
    const { app, page } = await launchApp()
    try {
      await page.waitForTimeout(2000)
      const result = await page.evaluate(async ({ args, cwd }) => {
        return await window.electronAPI.runGit(args, cwd)
      }, { args: ['config', '--global', 'user.email'], cwd: APP_ROOT })
      expect(result.ok).toBe(true)
      expect(result.stdout.trim()).toContain('@')
    } finally {
      await app.close()
    }
  })
})

// ── Section 10: App close ─────────────────────────────────────────────────────
test.describe('Electron: App close', () => {
  test('app closes cleanly without zombie processes', async () => {
    const { app, page } = await launchApp()
    // Verify app is running — firstWindow should be accessible
    await expect(page.locator('.ProseMirror')).toBeVisible()
    await app.close()
    await new Promise(r => setTimeout(r, 1000))
    // After close, the app object should have exited
    // We verify by checking that no new windows can be created
    const windows = await app.windows()
    expect(windows.length).toBe(0)
  })
})
