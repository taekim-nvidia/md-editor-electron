import React, { useState, useEffect, useCallback } from 'react'

interface GitStatusData {
  branch: string
  status: string
  log: string
}

interface Props {
  cwd?: string
  onSave?: () => Promise<void> | void
}

export default function GitPanel({ cwd, onSave }: Props) {
  const [statusData, setStatusData] = useState<GitStatusData | null>(null)
  const [commitMsg, setCommitMsg] = useState('')
  const [addAll, setAddAll] = useState(true)
  const [output, setOutput] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cwdInput, setCwdInput] = useState(cwd ?? '')

  // Always show output — never wipe it mid-operation
  const show = (msg: string, error = false) => {
    setOutput(msg.trim() || (error ? 'Unknown error' : 'Done'))
    setIsError(error)
  }

  const fetchStatus = useCallback(async () => {
    if (!cwdInput) return
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
        }
      } else {
        const res = await fetch(`/api/git/status?cwd=${encodeURIComponent(cwdInput)}`)
        const data = await res.json()
        if (data.ok) setStatusData(data)
      }
    } catch (_) {}
  }, [cwdInput])

  useEffect(() => {
    if (cwdInput) fetchStatus()
  }, [cwdInput, fetchStatus])

  const handlePull = async () => {
    setLoading(true)
    show('Pulling...')
    try {
      const r = window.electronAPI
        ? await window.electronAPI.runGit(['pull'], cwdInput)
        : await fetch('/api/git/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: cwdInput }) }).then(r => r.json())
      const msg = window.electronAPI
        ? (r.stdout + '\n' + r.stderr).trim()
        : (r.ok ? r.output : r.error)
      show(msg || 'Done', window.electronAPI ? !r.ok : !r.ok)
      if (r.ok) fetchStatus()
    } catch (e) { show(String(e), true) }
    finally { setLoading(false) }
  }

  const handlePush = async () => {
    setLoading(true)
    show('Pushing...')
    try {
      const r = window.electronAPI
        ? await window.electronAPI.runGit(['push'], cwdInput)
        : await fetch('/api/git/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: cwdInput }) }).then(r => r.json())
      const msg = window.electronAPI
        ? (r.stdout + '\n' + r.stderr).trim()
        : (r.ok ? r.output : r.error)
      show(msg || 'Done', window.electronAPI ? !r.ok : !r.ok)
      if (r.ok) fetchStatus()
    } catch (e) { show(String(e), true) }
    finally { setLoading(false) }
  }

  const handleCommit = async () => {
    if (!commitMsg.trim() || !cwdInput) return
    setLoading(true)

    // Step 1: Save
    if (onSave) {
      show('Step 1/3: Saving file...')
      try {
        await Promise.resolve(onSave())
      } catch (e) {
        show('Save failed: ' + String(e), true)
        setLoading(false)
        return
      }
    }

    // Step 2: git add
    if (addAll) {
      show('Step 2/3: Staging changes (git add -A)...')
      try {
        const addR = window.electronAPI
          ? await window.electronAPI.runGit(['add', '-A'], cwdInput)
          : await fetch('/api/git/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: cwdInput }) }).then(r => r.json())
        if (!addR.ok) {
          show('git add failed:\n' + ((addR.stderr || addR.stdout || addR.error || 'unknown')), true)
          setLoading(false)
          return
        }
      } catch (e) {
        show('git add failed: ' + String(e), true)
        setLoading(false)
        return
      }
    }

    // Step 3: git commit
    show('Step 3/3: Committing...')
    try {
      const r = window.electronAPI
        ? await window.electronAPI.runGit(['commit', '-m', commitMsg], cwdInput)
        : await fetch('/api/git/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: cwdInput, message: commitMsg, addAll }) }).then(r => r.json())
      const msg = window.electronAPI
        ? (r.stdout + '\n' + r.stderr).trim()
        : (r.ok ? r.output : r.error)
      show(msg || (r.ok ? 'Committed.' : 'Commit failed'), !r.ok)
      if (r.ok) { setCommitMsg(''); fetchStatus() }
    } catch (e) {
      show('Commit failed: ' + String(e), true)
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 w-72 shrink-0 text-sm">
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
            <input type="text" value={cwdInput} onChange={(e) => setCwdInput(e.target.value)}
              placeholder="/path/to/repo"
              className="flex-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400" />
            <button onClick={fetchStatus} disabled={loading}
              className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">↻</button>
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
          <button onClick={handlePull} disabled={loading || !cwdInput}
            className="flex-1 py-1.5 text-xs rounded bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 disabled:opacity-50">
            Pull
          </button>
          <button onClick={handlePush} disabled={loading || !cwdInput}
            className="flex-1 py-1.5 text-xs rounded bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 disabled:opacity-50">
            Push
          </button>
        </div>

        {/* Commit */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Commit message</label>
          <textarea value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="feat: your change" rows={2}
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

        {/* Output */}
        {output && (
          <div className={`rounded p-2 border ${isError
            ? 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600'
            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            {isError && <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">ERROR</div>}
            <pre className={`text-xs whitespace-pre-wrap break-all ${isError ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>
              {output}
            </pre>
          </div>
        )}

        {loading && <div className="text-xs text-center text-gray-400 animate-pulse">Running…</div>}
      </div>
    </div>
  )
}
