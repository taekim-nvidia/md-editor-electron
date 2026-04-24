// Unified API layer: routes through Electron IPC when available,
// falls back to fetch against the Express backend otherwise.

const GH_WORKSPACE = '/tmp/gh-workspace'

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface GitStatusResult {
  ok: boolean
  status: string
  branch: string
  log: string
  error?: string
}

export interface ActionResult {
  ok: boolean
  output: string
  error?: string
}

export interface GhRepo {
  nameWithOwner: string
  description: string
  isPrivate: boolean
  updatedAt: string
}

export interface CloneResult {
  ok: boolean
  path: string
  output: string
  action: 'cloned' | 'pulled'
  error?: string
}

export interface FileEntry {
  name: string
  isDir: boolean
  path: string
}

export interface ReadResult {
  ok: boolean
  content: string
  error?: string
}

export interface FetchUrlResult {
  ok: boolean
  content: string
  url: string
  error?: string
}

// ── Git ───────────────────────────────────────────────────────────────────────

export async function gitStatus(cwd: string): Promise<GitStatusResult> {
  if (isElectron()) {
    try {
      const [statusRes, branchRes, logRes] = await Promise.all([
        window.electronAPI!.runGit(['status', '--porcelain'], cwd),
        window.electronAPI!.runGit(['branch', '--show-current'], cwd),
        window.electronAPI!.runGit(['log', '--oneline', '-10'], cwd).catch(() => ({ ok: true, stdout: '', stderr: '' })),
      ])
      return {
        ok: true,
        status: statusRes.stdout.trim(),
        branch: branchRes.stdout.trim(),
        log: logRes.stdout.trim(),
      }
    } catch (err) {
      return { ok: false, status: '', branch: '', log: '', error: String(err) }
    }
  }
  const res = await fetch(`/api/git/status?cwd=${encodeURIComponent(cwd)}`)
  return res.json()
}

export async function gitPull(cwd: string): Promise<ActionResult> {
  if (isElectron()) {
    try {
      const r = await window.electronAPI!.runGit(['pull'], cwd)
      return { ok: r.ok, output: r.stdout + r.stderr }
    } catch (err) {
      return { ok: false, output: '', error: String(err) }
    }
  }
  const res = await fetch('/api/git/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd }),
  })
  return res.json()
}

export async function gitPush(cwd: string): Promise<ActionResult> {
  if (isElectron()) {
    try {
      const r = await window.electronAPI!.runGit(['push'], cwd)
      return { ok: r.ok, output: r.stdout + r.stderr }
    } catch (err) {
      return { ok: false, output: '', error: String(err) }
    }
  }
  const res = await fetch('/api/git/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd }),
  })
  return res.json()
}

export async function gitCommit(cwd: string, message: string, addAll?: boolean): Promise<ActionResult> {
  if (isElectron()) {
    try {
      if (addAll) {
        await window.electronAPI!.runGit(['add', '-A'], cwd)
      }
      const r = await window.electronAPI!.runGit(['commit', '-m', message], cwd)
      const output = (r.stdout + r.stderr).trim()
      console.log('[gitCommit] result:', r)
      return { ok: r.ok, output, error: r.ok ? undefined : (output || 'Commit failed') }
    } catch (err) {
      console.error('[gitCommit] exception:', err)
      return { ok: false, output: '', error: String(err) }
    }
  }
  const res = await fetch('/api/git/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd, message, addAll }),
  })
  return res.json()
}

// ── GitHub ────────────────────────────────────────────────────────────────────

export async function ghRepos(): Promise<{ ok: boolean; repos: GhRepo[]; error?: string }> {
  if (isElectron()) {
    try {
      const r = await window.electronAPI!.runGh([
        'repo', 'list', '--limit', '50',
        '--json', 'nameWithOwner,description,isPrivate,updatedAt',
      ])
      if (!r.ok) return { ok: false, repos: [], error: r.stderr }
      return { ok: true, repos: JSON.parse(r.stdout) }
    } catch (err) {
      return { ok: false, repos: [], error: String(err) }
    }
  }
  const res = await fetch('/api/gh/repos')
  return res.json()
}

export async function ghClone(repo: string): Promise<CloneResult> {
  if (isElectron()) {
    const repoName = repo.split('/').pop() ?? repo.replace('/', '_')
    const destPath = `${GH_WORKSPACE}/${repoName}`
    try {
      // If readDir succeeds the directory already exists — pull instead
      await window.electronAPI!.readDir(destPath)
      const r = await window.electronAPI!.runGit(['pull'], destPath)
      return { ok: r.ok, path: destPath, output: r.stdout + r.stderr, action: 'pulled' }
    } catch {
      // Directory doesn't exist yet — clone it
      try {
        const r = await window.electronAPI!.runGh(['repo', 'clone', repo, destPath])
        if (!r.ok) {
          return { ok: false, path: '', output: r.stdout + r.stderr, action: 'cloned', error: r.stderr }
        }
        return { ok: true, path: destPath, output: r.stdout + r.stderr, action: 'cloned' }
      } catch (err) {
        return { ok: false, path: '', output: '', action: 'cloned', error: String(err) }
      }
    }
  }
  const res = await fetch('/api/gh/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo }),
  })
  return res.json()
}

export async function ghFiles(dir: string): Promise<{ ok: boolean; files: FileEntry[]; error?: string }> {
  if (isElectron()) {
    try {
      const files = await window.electronAPI!.readDir(dir)
      return { ok: true, files }
    } catch (err) {
      return { ok: false, files: [], error: String(err) }
    }
  }
  const res = await fetch(`/api/gh/files?path=${encodeURIComponent(dir)}`)
  return res.json()
}

export async function ghReadFile(filePath: string): Promise<ReadResult> {
  if (isElectron()) {
    try {
      const content = await window.electronAPI!.readFile(filePath)
      return { ok: true, content }
    } catch (err) {
      return { ok: false, content: '', error: String(err) }
    }
  }
  const res = await fetch(`/api/gh/read?path=${encodeURIComponent(filePath)}`)
  return res.json()
}

export async function ghCommitPush(repoPath: string, message: string, addAll?: boolean): Promise<ActionResult> {
  if (isElectron()) {
    try {
      if (addAll) {
        await window.electronAPI!.runGit(['add', '-A'], repoPath)
      }
      const commitR = await window.electronAPI!.runGit(['commit', '-m', message], repoPath)
      const pushR = await window.electronAPI!.runGit(['push'], repoPath)
      return {
        ok: commitR.ok && pushR.ok,
        output: commitR.stdout + commitR.stderr + '\n' + pushR.stdout + pushR.stderr,
      }
    } catch (err) {
      return { ok: false, output: '', error: String(err) }
    }
  }
  const res = await fetch('/api/gh/commit-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath, message, addAll }),
  })
  return res.json()
}

// ── GitHub PR ─────────────────────────────────────────────────────────────────

export interface PRAuthor {
  login: string
}

export interface PRLabel {
  name: string
  color: string
}

export interface PR {
  number: number
  title: string
  author: PRAuthor
  createdAt: string
  updatedAt: string
  labels: PRLabel[]
  isDraft: boolean
  headRefName: string
  baseRefName: string
  state: string
}

export interface PRDetail extends PR {
  body: string
  url: string
  mergedAt?: string
  reviewDecision?: string
}

export interface PRComment {
  id: number
  login: string
  body: string
  createdAt: string
  type: 'comment' | 'review'
  state?: string
}

export async function ghPRs(
  repo: string,
  state: string
): Promise<{ ok: boolean; prs: PR[]; error?: string }> {
  const res = await fetch(
    `/api/gh/prs?repo=${encodeURIComponent(repo)}&state=${encodeURIComponent(state)}`
  )
  return res.json()
}

export async function ghPR(
  repo: string,
  number: number
): Promise<{ ok: boolean; pr: PRDetail; error?: string }> {
  const res = await fetch(
    `/api/gh/pr?repo=${encodeURIComponent(repo)}&number=${number}`
  )
  return res.json()
}

export async function ghPRComments(
  repo: string,
  number: number
): Promise<{ ok: boolean; comments: PRComment[]; error?: string }> {
  const res = await fetch(
    `/api/gh/pr/comments?repo=${encodeURIComponent(repo)}&number=${number}`
  )
  return res.json()
}

export async function ghPRComment(
  repo: string,
  number: number,
  body: string
): Promise<ActionResult> {
  const res = await fetch('/api/gh/pr/comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo, number, body }),
  })
  return res.json()
}

export async function ghPRReview(
  repo: string,
  number: number,
  body: string,
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
): Promise<ActionResult> {
  const res = await fetch('/api/gh/pr/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo, number, body, event }),
  })
  return res.json()
}

export async function ghPRCreate(
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<{ ok: boolean; output: string; url?: string; error?: string }> {
  const res = await fetch('/api/gh/pr/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo, title, body, head, base }),
  })
  return res.json()
}

export async function ghPRDiff(
  repo: string,
  number: number
): Promise<{ ok: boolean; diff: string; error?: string }> {
  const res = await fetch(
    `/api/gh/pr/diff?repo=${encodeURIComponent(repo)}&number=${number}`
  )
  return res.json()
}

export async function gitBranches(
  cwd: string
): Promise<{ ok: boolean; branches: string[]; error?: string }> {
  const res = await fetch(`/api/git/branches?cwd=${encodeURIComponent(cwd)}`)
  return res.json()
}

export async function gitRemote(
  cwd: string
): Promise<{ ok: boolean; remote: string; repo: string; error?: string }> {
  const res = await fetch(`/api/git/remote?cwd=${encodeURIComponent(cwd)}`)
  return res.json()
}

// ── URL fetch ─────────────────────────────────────────────────────────────────

export async function fetchMarkdownUrl(url: string): Promise<FetchUrlResult> {
  if (isElectron()) {
    // Route through Electron IPC — main process handles GitHub blob → raw redirect
    try {
      const r = await window.electronAPI!.fetchUrl(url)
      if (!r.ok) return { ok: false, content: '', url: r.url ?? url, error: r.error }
      return { ok: true, content: r.content ?? '', url: r.url ?? url }
    } catch (err) {
      return { ok: false, content: '', url, error: String(err) }
    }
  }

  const res = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return res.json()
}
