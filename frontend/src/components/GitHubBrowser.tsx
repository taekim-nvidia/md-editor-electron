import React, { useState, useEffect } from 'react'
import { GhRepo, FileEntry } from '../types'
import { ghPRs, PR } from '../lib/api'

interface Props {
  onOpenFile: (filename: string, content: string, path: string) => void
  onSave?: () => Promise<void> | void
  onRepoLoaded?: (nameWithOwner: string, repoPath: string) => void
  initialRepo?: { name: string, path: string }
}

type View = 'repos' | 'files'

export default function GitHubBrowser({ onOpenFile, onSave, onRepoLoaded, initialRepo }: Props) {
  const [view, setView] = useState<View>('repos')
  const [repos, setRepos] = useState<GhRepo[]>([])
  const [repoPath, setRepoPath] = useState('')
  const [currentDir, setCurrentDir] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [dirStack, setDirStack] = useState<string[]>([])
  const [activeRepo, setActiveRepo] = useState('')
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState('')
  const [isError, setIsError] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [prs, setPrs] = useState<PR[]>([])
  const [prsLoading, setPrsLoading] = useState(false)
  const [orgs, setOrgs] = useState<string[]>([])
  const [orgFilter, setOrgFilter] = useState<string>('all')

  const showOutput = (msg: string, error = false) => {
    setOutput(msg.trim())
    setIsError(error)
  }

  // Auto-navigate when initialRepo changes (from URL load)
  useEffect(() => {
    if (initialRepo?.name) {
      cloneRepo(initialRepo.name)
    }
  }, [initialRepo?.name])

  const fetchRepos = async () => {
    setLoading(true)
    showOutput('')
    try {
      if (window.electronAPI) {
        const r = await window.electronAPI.runGh([
          'repo', 'list', '--limit', '100',
          '--json', 'nameWithOwner,description,isPrivate,updatedAt',
        ])
        if (r.ok) {
          const allRepos = JSON.parse(r.stdout)
          setRepos(allRepos)
          // Extract unique owners for org switcher
          const owners = Array.from(new Set<string>(allRepos.map((repo: any) => repo.nameWithOwner.split('/')[0] as string)))
          setOrgs(owners)
        } else {
          showOutput('Error loading repos:\n' + (r.stderr || r.stdout), true)
        }
      } else {
        const res = await fetch('/api/gh/repos')
        const data = await res.json()
        if (data.ok) setRepos(data.repos)
        else showOutput('Error: ' + data.error, true)
      }
    } catch (e) {
      showOutput('Network error: ' + String(e), true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRepos() }, [])

  const cloneRepo = async (nameWithOwner: string) => {
    setLoading(true)
    showOutput('Cloning ' + nameWithOwner + '…')
    try {
      if (window.electronAPI) {
        const r = await window.electronAPI.ghClone(nameWithOwner)
        if (r.ok) {
          setRepoPath(r.path!)
          setActiveRepo(nameWithOwner)
          setDirStack([])
          loadFiles(r.path!)
          setView('files')
          showOutput(r.action === 'pulled' ? 'Pulled latest.' : 'Cloned successfully.')
          onRepoLoaded?.(nameWithOwner, r.path!)
          loadPRs(nameWithOwner)
        } else {
          showOutput('Clone failed:\n' + (r.error ?? 'unknown error'), true)
        }
      } else {
        const res = await fetch('/api/gh/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: nameWithOwner }),
        })
        const data = await res.json()
        if (data.ok) {
          setRepoPath(data.path)
          setActiveRepo(nameWithOwner)
          setDirStack([])
          loadFiles(data.path)
          setView('files')
          showOutput(data.action === 'pulled' ? 'Pulled latest.' : 'Cloned successfully.')
          onRepoLoaded?.(nameWithOwner, data.path)
          loadPRs(nameWithOwner)
        } else {
          showOutput('Clone failed:\n' + data.error, true)
        }
      }
    } catch (e) {
      showOutput('Error: ' + String(e), true)
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async (dir: string) => {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const entries = await window.electronAPI.readDir(dir)
        setFiles(entries)
        setCurrentDir(dir)
      } else {
        const res = await fetch('/api/gh/files?path=' + encodeURIComponent(dir))
        const data = await res.json()
        if (data.ok) { setFiles(data.files); setCurrentDir(dir) }
        else showOutput('Error: ' + data.error, true)
      }
    } catch (e) {
      showOutput('Error loading files: ' + String(e), true)
    } finally {
      setLoading(false)
    }
  }

  const loadPRs = async (repo: string) => {
    setPrsLoading(true)
    try {
      const result = await ghPRs(repo, 'open')
      if (result.ok) setPrs(result.prs ?? [])
      else setPrs([])
    } catch (_) {
      setPrs([])
    } finally {
      setPrsLoading(false)
    }
  }

  const openFile = async (filePath: string, fileName: string) => {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const content = await window.electronAPI.readFile(filePath)
        onOpenFile(fileName, content, filePath)
      } else {
        const res = await fetch('/api/gh/read?path=' + encodeURIComponent(filePath))
        const data = await res.json()
        if (data.ok) onOpenFile(fileName, data.content, filePath)
        else showOutput('Error: ' + data.error, true)
      }
    } catch (e) {
      showOutput('Error opening file: ' + String(e), true)
    } finally {
      setLoading(false)
    }
  }

  const navigateInto = (dir: FileEntry) => {
    setDirStack((s) => [...s, currentDir])
    loadFiles(dir.path)
  }

  const navigateUp = () => {
    const stack = [...dirStack]
    const parent = stack.pop()
    setDirStack(stack)
    if (parent) loadFiles(parent)
  }

  const commitAndPush = async () => {
    if (!commitMsg.trim() || !repoPath) return
    setLoading(true)

    // Step 1: Save
    showOutput('Step 1/3: Saving file…')
    try {
      if (onSave) await Promise.resolve(onSave())
    } catch (e) {
      showOutput('Save failed: ' + String(e), true)
      setLoading(false)
      return
    }

    if (window.electronAPI) {
      // Step 2: git add -A
      showOutput('Step 2/3: Staging changes (git add -A)…')
      const addR = await window.electronAPI.runGit(['add', '-A'], repoPath)
      if (!addR.ok) {
        showOutput('git add failed:\n' + (addR.stderr || addR.stdout || 'unknown error'), true)
        setLoading(false)
        return
      }

      // Step 3: git commit
      showOutput('Step 3/3: Committing…')
      const commitR = await window.electronAPI.runGit(['commit', '-m', commitMsg], repoPath)
      const commitOut = (commitR.stdout + '\n' + commitR.stderr).trim()
      if (!commitR.ok) {
        if (commitOut.includes('nothing to commit')) {
          showOutput('Nothing to commit — working tree clean.')
          setLoading(false)
          return
        }
        showOutput('Commit failed:\n' + commitOut, true)
        setLoading(false)
        return
      }

      // Step 4: git push
      showOutput('Pushing to remote…')
      const pushR = await window.electronAPI.runGit(['push'], repoPath)
      const pushOut = (pushR.stdout + '\n' + pushR.stderr).trim()
      if (!pushR.ok) {
        showOutput('Push failed:\n' + pushOut, true)
        setLoading(false)
        return
      }

      const finalOut = [commitOut, pushOut].filter(Boolean).join('\n')
      showOutput(finalOut || 'Committed and pushed successfully.')
      setCommitMsg('')
    } else {
      try {
        const res = await fetch('/api/gh/commit-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoPath, message: commitMsg, addAll: true }),
        })
        const data = await res.json()
        if (data.ok) { showOutput(data.output || 'Done.'); setCommitMsg('') }
        else showOutput('Error:\n' + (data.error || 'unknown'), true)
      } catch (e) {
        showOutput('Network error: ' + String(e), true)
      }
    }

    setLoading(false)
  }

  const isTextFile = (name: string) =>
    /\.(md|txt|ts|tsx|js|jsx|json|yaml|yml|toml|sh|py|rs|go|c|cpp|h|css|html|xml|svg)$/i.test(name)

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 w-72 shrink-0 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">
        <div className="flex items-center gap-2">
          {view === 'files' && (
            <button
              onClick={() => { setView('repos'); setPrs([]) }}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs"
            >
              ← Repos
            </button>
          )}
          <span>{view === 'repos' ? 'GitHub' : (activeRepo.split('/')[1] ?? activeRepo)}</span>
        </div>
        <button
          onClick={view === 'repos' ? fetchRepos : () => loadFiles(currentDir)}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          title="Refresh"
        >↻</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Repo list */}
        {view === 'repos' && (
          <div>
            {loading && (
              <div className="text-xs text-center text-gray-400 p-4 animate-pulse">Loading repos…</div>
            )}
            {repos.map((repo) => (
              <div key={repo.nameWithOwner}
                className="flex items-start justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer group"
                onClick={() => cloneRepo(repo.nameWithOwner)}>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                    {repo.nameWithOwner}
                  </div>
                  {repo.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {repo.description}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-2 group-hover:text-indigo-500">→</span>
              </div>
            ))}
          </div>
        )}

        {/* File browser + PRs */}
        {view === 'files' && (
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              {dirStack.length > 0 && (
                <button onClick={navigateUp} className="hover:text-gray-700 dark:hover:text-gray-200">
                  ← Up
                </button>
              )}
              <span className="truncate ml-auto">{currentDir.split('/').pop()}</span>
            </div>

            {loading && (
              <div className="text-xs text-center text-gray-400 p-3 animate-pulse">Loading…</div>
            )}

            {files.map((file) => (
              <div key={file.path}
                className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => {
                  if (file.isDir) navigateInto(file)
                  else if (isTextFile(file.name)) openFile(file.path, file.name)
                }}>
                <span className="text-sm">{file.isDir ? '📁' : isTextFile(file.name) ? '📄' : '📎'}</span>
                <span className={`text-xs truncate ${!file.isDir && !isTextFile(file.name) ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                  {file.name}
                </span>
              </div>
            ))}

            {/* Open PRs */}
            {(prs.length > 0 || prsLoading) && (
              <div className="border-t border-gray-200 dark:border-gray-700 mt-2">
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
                  Open PRs {prs.length > 0 && `(${prs.length})`}
                </div>
                {prsLoading && (
                  <div className="text-xs text-center text-gray-400 p-2 animate-pulse">Loading PRs…</div>
                )}
                {prs.map((pr) => (
                  <div key={pr.number}
                    className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    title={`Open PR #${pr.number} on GitHub`}
                    onClick={() => window.open('https://github.com/' + activeRepo + '/pull/' + pr.number, '_blank')}>
                    <span className="text-xs text-green-600 dark:text-green-400 font-mono shrink-0">#{pr.number}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-800 dark:text-gray-200 truncate">{pr.title}</div>
                      <div className="text-xs text-gray-400">{pr.author?.login ?? ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Commit + push */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 mt-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Commit &amp; Push</div>
              <textarea
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message"
                rows={2}
                className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400 resize-none"
              />
              <button
                onClick={commitAndPush}
                disabled={loading || !commitMsg.trim()}
                className="mt-1.5 w-full py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              >
                Commit &amp; Push
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Output — red on error, normal on success */}
      {output && (
        <div className={`px-3 py-2 border-t ${isError
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
          {isError && (
            <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">ERROR</div>
          )}
          <pre className={`text-xs whitespace-pre-wrap max-h-32 overflow-y-auto ${isError
            ? 'text-red-700 dark:text-red-300'
            : 'text-gray-600 dark:text-gray-400'}`}>
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}
