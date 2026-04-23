import React, { useState, useEffect } from 'react'
import { GhRepo, FileEntry } from '../types'

interface Props {
  onOpenFile: (filename: string, content: string, path: string) => void
}

type View = 'repos' | 'files'

export default function GitHubBrowser({ onOpenFile }: Props) {
  const [view, setView] = useState<View>('repos')
  const [repos, setRepos] = useState<GhRepo[]>([])
  const [repoPath, setRepoPath] = useState('')
  const [currentDir, setCurrentDir] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [dirStack, setDirStack] = useState<string[]>([])
  const [activeRepo, setActiveRepo] = useState('')
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState('')
  const [commitMsg, setCommitMsg] = useState('')

  const fetchRepos = async () => {
    setLoading(true)
    setOutput('')
    try {
      if (window.electronAPI) {
        const r = await window.electronAPI.runGh([
          'repo', 'list', '--limit', '50',
          '--json', 'nameWithOwner,description,isPrivate,updatedAt',
        ])
        if (r.ok) {
          setRepos(JSON.parse(r.stdout))
        } else {
          setOutput('Error: ' + r.stderr)
        }
      } else {
        const res = await fetch('/api/gh/repos')
        const data = await res.json()
        if (data.ok) {
          setRepos(data.repos)
        } else {
          setOutput('Error: ' + data.error)
        }
      }
    } catch (e) {
      setOutput('Network error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRepos()
  }, [])

  const cloneRepo = async (nameWithOwner: string) => {
    setLoading(true)
    setOutput(`Cloning ${nameWithOwner}…`)
    try {
      if (window.electronAPI) {
        const r = await window.electronAPI.ghClone(nameWithOwner)
        if (r.ok) {
          setRepoPath(r.path!)
          setActiveRepo(nameWithOwner)
          setDirStack([])
          loadFiles(r.path!)
          setView('files')
          setOutput(r.action === 'pulled' ? 'Pulled latest changes.' : 'Cloned successfully.')
        } else {
          setOutput('Error: ' + r.error)
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
          setOutput(data.action === 'pulled' ? 'Pulled latest changes.' : 'Cloned successfully.')
        } else {
          setOutput('Error: ' + data.error)
        }
      }
    } catch (e) {
      setOutput('Network error: ' + String(e))
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
        const res = await fetch(`/api/gh/files?path=${encodeURIComponent(dir)}`)
        const data = await res.json()
        if (data.ok) {
          setFiles(data.files)
          setCurrentDir(dir)
        } else {
          setOutput('Error: ' + data.error)
        }
      }
    } catch (e) {
      setOutput('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const openFile = async (filePath: string, fileName: string) => {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const content = await window.electronAPI.readFile(filePath)
        onOpenFile(fileName, content, filePath)
      } else {
        const res = await fetch(`/api/gh/read?path=${encodeURIComponent(filePath)}`)
        const data = await res.json()
        if (data.ok) {
          onOpenFile(fileName, data.content, filePath)
        } else {
          setOutput('Error: ' + data.error)
        }
      }
    } catch (e) {
      setOutput('Error: ' + String(e))
    } finally {
      setLoading(false)
    }
  }

  const navigateInto = (dir: FileEntry) => {
    setDirStack((s) => [...s, currentDir])
    loadFiles(dir.path)
  }

  const navigateUp = () => {
    const newStack = [...dirStack]
    const parent = newStack.pop()
    setDirStack(newStack)
    if (parent) loadFiles(parent)
  }

  const commitAndPush = async () => {
    if (!commitMsg.trim()) return
    setLoading(true)
    setOutput('')
    try {
      if (window.electronAPI) {
        const addR = await window.electronAPI.runGit(['add', '-A'], repoPath)
        if (!addR.ok) {
          setOutput('Error during add: ' + addR.stderr)
          return
        }
        const commitR = await window.electronAPI.runGit(
          ['commit', '-m', commitMsg],
          repoPath
        )
        if (!commitR.ok) {
          setOutput('Error during commit: ' + commitR.stderr)
          return
        }
        const pushR = await window.electronAPI.runGit(['push'], repoPath)
        const combined =
          commitR.stdout +
          (commitR.stderr ? '\n' + commitR.stderr : '') +
          '\n' +
          pushR.stdout +
          (pushR.stderr ? '\n' + pushR.stderr : '')
        setOutput(combined)
        if (pushR.ok) setCommitMsg('')
      } else {
        const res = await fetch('/api/gh/commit-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoPath, message: commitMsg, addAll: true }),
        })
        const data = await res.json()
        setOutput(data.ok ? data.output : 'Error: ' + data.error)
        if (data.ok) setCommitMsg('')
      }
    } catch (e) {
      setOutput('Network error: ' + String(e))
    } finally {
      setLoading(false)
    }
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
              onClick={() => setView('repos')}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs"
            >
              ← Repos
            </button>
          )}
          <span>
            {view === 'repos' ? 'GitHub' : (activeRepo.split('/')[1] ?? activeRepo)}
          </span>
        </div>
        <button
          onClick={view === 'repos' ? fetchRepos : () => loadFiles(currentDir)}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Repo list */}
        {view === 'repos' && (
          <div>
            {loading && (
              <div className="text-xs text-center text-gray-400 p-4 animate-pulse">
                Loading repos…
              </div>
            )}
            {repos.map((repo) => (
              <div
                key={repo.nameWithOwner}
                className="flex items-start justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer group"
                onClick={() => cloneRepo(repo.nameWithOwner)}
              >
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
                <span className="text-xs text-gray-400 shrink-0 ml-2 group-hover:text-indigo-500">
                  →
                </span>
              </div>
            ))}
          </div>
        )}

        {/* File browser */}
        {view === 'files' && (
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              {dirStack.length > 0 && (
                <button
                  onClick={navigateUp}
                  className="hover:text-gray-700 dark:hover:text-gray-200"
                >
                  ← Up
                </button>
              )}
              <span className="truncate ml-auto">{currentDir.split('/').pop()}</span>
            </div>

            {loading && (
              <div className="text-xs text-center text-gray-400 p-3 animate-pulse">
                Loading…
              </div>
            )}

            {files.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => {
                  if (file.isDir) navigateInto(file)
                  else if (isTextFile(file.name)) openFile(file.path, file.name)
                }}
              >
                <span className="text-sm">
                  {file.isDir ? '📁' : isTextFile(file.name) ? '📄' : '📎'}
                </span>
                <span
                  className={`text-xs truncate ${
                    !file.isDir && !isTextFile(file.name)
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {file.name}
                </span>
              </div>
            ))}

            {/* Commit + push */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 mt-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
                Commit &amp; Push
              </div>
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

      {/* Output */}
      {output && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <pre className="text-xs whitespace-pre-wrap text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}
