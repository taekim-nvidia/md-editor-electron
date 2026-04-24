import React, { useState, useEffect, useCallback } from 'react'

interface GitStatusData {
  branch: string
  status: string
  log: string
}

interface Props {
  cwd?: string
  onSave?: () => void
}

export default function GitPanel({ cwd, onSave }: Props) {
  const [statusData, setStatusData] = useState<GitStatusData | null>(null)
  const [commitMsg, setCommitMsg] = useState('')
  const [addAll, setAddAll] = useState(true)
  const [output, setOutput] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cwdInput, setCwdInput] = useState(cwd ?? '')

  const showOutput = (msg: string, error: boolean) => {
    const text = msg.trim() || (error ? 'Unknown error' : 'Done')
    console.log('[GitPanel]', error ? 'ERROR:' : 'OK:', text)
    setOutput(text)
    setIsError(error)
  }

  const fetchStatus = useCallback(async () => {
    if (!cwdInput) return
    setLoading(true)
    try {
      if (window.electronAPI) {
        const [statusRes, branchRes, logRes] = await Promise.all([
          window.electronAPI.runGit(['status', '--porcelain'], cwdInput),
          window.electronAPI.runGit(['branch', '--show-current'], cwdInput),
          window.electronAPI.runGit(['log', '--oneline', '-10'], cwdInput),
        ])
        if (statusRes.ok) {
          setStatusData({
            status: statusRes.stdout.trim(),
            branch: branchRes.stdout.trim(),
            log: logRes.stdout.trim(),
          })
        } else {
          showOutput(statusRes.stderr || statusRes.stdout || 'git status failed', true)
        }
      } else {
        const res = await fetch(`/api/git/status?cwd=${encodeURIComponent(cwdInput)}`)
        const data = await res.json()
        if (data.ok) setStatusData(data)
        else showOutput(data.error || 'git status failed', true)
      }
    } catch (e) {
      showOutput(String(e), true)
    } finally {
      setLoading(false)
    }
  }, [cwdInput])

  useEffect(() => {
    if (cwdInput) fetchStatus()
  }, [cwdInput, fetchStatus])

  const runGitOp = useCallback(async (electronArgs: string[], webEndpoint: string) => {
    setLoading(true)
    setOutput('')
    setIsError(false)
    try {
      if (window.electronAPI) {
        const r = await window.electronAPI.runGit(electronArgs, cwdInput)
        const msg = (r.stdout + '\n' + r.stderr).trim()
        showOutput(msg || (r.ok ? 'Done' : 'Failed'), !r.ok)
        if (r.ok) fetchStatus()
      } else {
        const res = await fetch(webEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cwd: cwdInput }),
        })
        const data = await res.json()
        showOutput(data.ok ? data.output : data.error || 'Failed', !data.ok)
        if (data.ok) fetchStatus()
      }
    } catch (e) {
      showOutput(String(e), true)
    } finally {
      setLoading(false)
    }
  }, [cwdInput, fetchStatus])

  const handleCommit = async () => {
    if (!commitMsg.trim() || !cwdInput) return
    // Auto-save before committing
    onSave?.()
    // Small delay to ensure file is written
    await new Promise(r => setTimeout(r, 100))
    setLoading(true)
    setOutput('')
    setIsError(false)
    try {
      if (window.electronAPI) {
        if (addAll) {
          const addR = await window.electronAPI.runGit(['add', '-A'], cwdInput)
          if (!addR.ok) {
            showOutput('git add failed:\n' + (addR.stderr || addR.stdout || 'unknown'), true)
            return
          }
        }
        const r = await window.electronAPI.runGit(['commit', '-m', commitMsg], cwdInput)
        const msg = (r.stdout + '\n' + r.stderr).trim()
        showOutput(msg || (r.ok ? 'Committed.' : 'Commit failed'), !r.ok)
        if (r.ok) { setCommitMsg(''); fetchStatus() }
      } else {
        const res = await fetch('/api/git/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cwd: cwdInput, message: commitMsg, addAll }),
        })
        const data = await res.json()
        showOutput(data.ok ? data.output : data.error || 'Commit failed', !data.ok)
        if (data.ok) { setCommitMsg(''); fetchStatus() }
      }
    } catch (e) {
      showOutput(String(e), true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 w-72 shrink-0 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">
        <span>Git</span>
        {statusData && (
          <span className="text-xs font-normal text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
            {statusData.branch}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

        {/* Working dir */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Working directory</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={cwdInput}
              onChange={(e) => setCwdInput(e.target.value)}
              placeholder="/path/to/repo"
              className="flex-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400"
            />
            <button onClick={fetchStatus} disabled={loading}
              className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
              ↻
            </button>
          </div>
        </div>

        {/* Status */}
        {statusData && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</div>
            <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-2 whitespace-pre-wrap text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
              {statusData.status || '(clean)'}
            </pre>
          </div>
        )}

        {/* Pull / Push */}
        <div className="flex gap-2">
          <button onClick={() => runGitOp(['pull'], '/api/git/pull')}
            disabled={loading || !cwdInput}
            className="flex-1 py-1.5 text-xs rounded bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 disabled:opacity-50">
            Pull
          </button>
          <button onClick={() => runGitOp(['push'], '/api/git/push')}
            disabled={loading || !cwdInput}
            className="flex-1 py-1.5 text-xs rounded bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 disabled:opacity-50">
            Push
          </button>
        </div>

        {/* Commit */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Commit message</label>
          <textarea value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="feat: your change"
            rows={2}
            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400 resize-none" />
          <div className="flex items-center gap-2 mt-1.5">
            <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={addAll} onChange={(e) => setAddAll(e.target.checked)} className="accent-indigo-500" />
              git add -A
            </label>
            <button onClick={handleCommit} disabled={loading || !commitMsg.trim() || !cwdInput}
              className="ml-auto px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
              Commit
            </button>
          </div>
        </div>

        {/* Recent commits */}
        {statusData?.log && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recent commits</div>
            <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-2 whitespace-pre-wrap text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
              {statusData.log}
            </pre>
          </div>
        )}

        {/* Output — ALWAYS visible when set, red on error */}
        {output && (
          <div className={`rounded p-2 border ${isError
            ? 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600'
            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            {isError && <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">ERROR</div>}
            <pre className={`text-xs whitespace-pre-wrap break-all ${isError
              ? 'text-red-700 dark:text-red-300'
              : 'text-gray-700 dark:text-gray-300'}`}>
              {output}
            </pre>
          </div>
        )}

        {loading && (
          <div className="text-xs text-center text-gray-400 animate-pulse">Running…</div>
        )}
      </div>
    </div>
  )
}
