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
        window.electronAPI!.git(['status', '--porcelain'], cwd),
        window.electronAPI!.git(['branch', '--show-current'], cwd),
        window.electronAPI!.git(['log', '--oneline', '-10'], cwd).catch(() => ({ stdout: '', stderr: '', code: 0 })),
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
      const r = await window.electronAPI!.git(['pull'], cwd)
      return { ok: r.code === 0, output: r.stdout + r.stderr }
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
      const r = await window.electronAPI!.git(['push'], cwd)
      return { ok: r.code === 0, output: r.stdout + r.stderr }
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
        await window.electronAPI!.git(['add', '-A'], cwd)
      }
      const r = await window.electronAPI!.git(['commit', '-m', message], cwd)
      return { ok: r.code === 0, output: r.stdout + r.stderr }
    } catch (err) {
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
      const r = await window.electronAPI!.gh([
        'repo', 'list', '--limit', '50',
        '--json', 'nameWithOwner,description,isPrivate,updatedAt',
      ])
      if (r.code !== 0) return { ok: false, repos: [], error: r.stderr }
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
      const r = await window.electronAPI!.git(['pull'], destPath)
      return { ok: r.code === 0, path: destPath, output: r.stdout + r.stderr, action: 'pulled' }
    } catch {
      // Directory doesn't exist yet — clone it
      try {
        const r = await window.electronAPI!.gh(['repo', 'clone', repo, destPath])
        if (r.code !== 0) {
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
        await window.electronAPI!.git(['add', '-A'], repoPath)
      }
      const commitR = await window.electronAPI!.git(['commit', '-m', message], repoPath)
      const pushR = await window.electronAPI!.git(['push'], repoPath)
      return {
        ok: commitR.code === 0 && pushR.code === 0,
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
  // Trim trailing punctuation that users sometimes accidentally include
  const cleanUrl = url.trim().replace(/[.,;!?]+$/, '')

  if (isElectron()) {
    // Always use the IPC handler — it supports private GitHub repos via gh CLI
    try {
      const r = await window.electronAPI!.fetchUrl(cleanUrl)
      if (!r.ok) return { ok: false, content: '', url: cleanUrl, error: r.error ?? 'Failed' }
      return { ok: true, content: r.content ?? '', url: r.url ?? cleanUrl }
    } catch (err) {
      return { ok: false, content: '', url: cleanUrl, error: String(err) }
    }
  }

  // Web version: convert github.com blob URLs to raw then fetch
  let fetchUrl = cleanUrl
  const ghMatch = cleanUrl.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
  )
  if (ghMatch) {
    const [, owner, repo, branch, filePath] = ghMatch
    fetchUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
  }

  const res = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: cleanUrl }),
  })
  return res.json()
}
