import React, { useState, useEffect, useCallback } from 'react'
import { marked } from 'marked'
import {
  ghPRs,
  ghPR,
  ghPRComments,
  ghPRComment,
  ghPRReview,
  ghPRCreate,
  ghPRDiff,
  gitBranches,
  gitRemote,
  PR,
  PRDetail,
  PRComment,
} from '../lib/api'

interface Props {
  cwd?: string
  onOpenFile?: (filename: string, content: string, path: string) => void
}

type Tab = 'list' | 'detail' | 'create'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function StateTag({ state, isDraft }: { state: string; isDraft?: boolean }) {
  if (isDraft) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        Draft
      </span>
    )
  }
  const lower = state.toLowerCase()
  const colorMap: Record<string, string> = {
    open: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    closed: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    merged: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  }
  const cls = colorMap[lower] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`}>
      {lower.charAt(0).toUpperCase() + lower.slice(1)}
    </span>
  )
}

function Avatar({ login }: { login: string }) {
  return (
    <div className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-200 text-xs flex items-center justify-center shrink-0 font-semibold">
      {login.charAt(0).toUpperCase()}
    </div>
  )
}

function MarkdownBody({ content }: { content: string }) {
  const html = marked.parse(content || '') as string
  return (
    <div
      className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed [&_h1]:font-bold [&_h1]:text-sm [&_h2]:font-bold [&_h2]:text-sm [&_h3]:font-semibold [&_strong]:font-semibold [&_em]:italic [&_code]:font-mono [&_code]:bg-gray-200 [&_code]:dark:bg-gray-600 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-gray-200 [&_pre]:dark:bg-gray-600 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_p]:mb-1 [&_li]:mb-0.5 [&_a]:text-indigo-500 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:dark:border-gray-600 [&_blockquote]:pl-2 [&_blockquote]:text-gray-500"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

const inputCls =
  'w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400'

export default function PRPanel({ cwd, onOpenFile }: Props) {
  const [tab, setTab] = useState<Tab>('list')
  const [repo, setRepo] = useState('')

  // List tab
  const [prState, setPrState] = useState<'open' | 'closed' | 'all'>('open')
  const [prs, setPrs] = useState<PR[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')

  // Detail tab
  const [selectedPR, setSelectedPR] = useState<PRDetail | null>(null)
  const [comments, setComments] = useState<PRComment[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [reviewBody, setReviewBody] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  // Create tab
  const [createTitle, setCreateTitle] = useState('')
  const [createBody, setCreateBody] = useState('')
  const [createBase, setCreateBase] = useState('')
  const [createHead, setCreateHead] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [createLoading, setCreateLoading] = useState(false)
  const [createResult, setCreateResult] = useState<{
    ok: boolean
    url?: string
    error?: string
  } | null>(null)

  // Auto-detect repo and current branch from cwd
  useEffect(() => {
    if (!cwd) return
    gitRemote(cwd)
      .then((r) => {
        if (r.ok && r.repo) setRepo(r.repo)
      })
      .catch(() => {})
    fetch(`/api/git/status?cwd=${encodeURIComponent(cwd)}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; branch: string }) => {
        if (d.ok && d.branch) setCreateHead(d.branch)
      })
      .catch(() => {})
  }, [cwd])

  useEffect(() => {
    if (!cwd) return
    gitBranches(cwd)
      .then((r) => {
        if (r.ok) setBranches(r.branches)
      })
      .catch(() => {})
  }, [cwd])

  const fetchPRs = useCallback(async () => {
    if (!repo.trim()) return
    setListLoading(true)
    setListError('')
    try {
      const data = await ghPRs(repo.trim(), prState)
      if (data.ok) {
        setPrs(data.prs)
      } else {
        setListError(data.error ?? 'Failed to fetch PRs')
      }
    } catch (e) {
      setListError('Network error: ' + String(e))
    } finally {
      setListLoading(false)
    }
  }, [repo, prState])

  useEffect(() => {
    if (repo) fetchPRs()
  }, [prState, fetchPRs]) // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (pr: PR) => {
    setTab('detail')
    setActionMsg('')
    setCommentBody('')
    setReviewBody('')
    setComments([])
    setSelectedPR(null)
    setDetailLoading(true)
    try {
      const [detailData, commentsData] = await Promise.all([
        ghPR(repo, pr.number),
        ghPRComments(repo, pr.number),
      ])
      if (detailData.ok) setSelectedPR(detailData.pr)
      if (commentsData.ok) setComments(commentsData.comments)
    } catch (e) {
      setActionMsg('Network error: ' + String(e))
    } finally {
      setDetailLoading(false)
    }
  }

  const handleOpenDiff = async () => {
    if (!selectedPR || !onOpenFile) return
    setDetailLoading(true)
    try {
      const data = await ghPRDiff(repo, selectedPR.number)
      if (data.ok) {
        const filename = `pr-${selectedPR.number}.diff`
        onOpenFile(filename, data.diff, filename)
      } else {
        setActionMsg('Error: ' + (data.error ?? 'Failed to fetch diff'))
      }
    } catch (e) {
      setActionMsg('Network error: ' + String(e))
    } finally {
      setDetailLoading(false)
    }
  }

  const handleComment = async () => {
    if (!selectedPR || !commentBody.trim()) return
    setCommentLoading(true)
    setActionMsg('')
    try {
      const data = await ghPRComment(repo, selectedPR.number, commentBody)
      if (data.ok) {
        setCommentBody('')
        setActionMsg('Comment posted!')
        const commentsData = await ghPRComments(repo, selectedPR.number)
        if (commentsData.ok) setComments(commentsData.comments)
      } else {
        setActionMsg('Error: ' + (data.error ?? 'Failed'))
      }
    } catch (e) {
      setActionMsg('Network error: ' + String(e))
    } finally {
      setCommentLoading(false)
    }
  }

  const handleReview = async (event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT') => {
    if (!selectedPR) return
    setReviewLoading(true)
    setActionMsg('')
    try {
      const data = await ghPRReview(repo, selectedPR.number, reviewBody, event)
      if (data.ok) {
        setReviewBody('')
        setActionMsg('Review submitted!')
      } else {
        setActionMsg('Error: ' + (data.error ?? 'Failed'))
      }
    } catch (e) {
      setActionMsg('Network error: ' + String(e))
    } finally {
      setReviewLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!createTitle.trim() || !createBase || !createHead || !repo.trim()) return
    setCreateLoading(true)
    setCreateResult(null)
    try {
      const data = await ghPRCreate(repo.trim(), createTitle, createBody, createHead, createBase)
      setCreateResult({ ok: data.ok, url: data.url, error: data.error })
      if (data.ok) {
        setCreateTitle('')
        setCreateBody('')
        fetchPRs()
      }
    } catch (e) {
      setCreateResult({ ok: false, error: String(e) })
    } finally {
      setCreateLoading(false)
    }
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
        tab === t
          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 w-[360px] shrink-0 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">
        <span>Pull Requests</span>
        <button
          onClick={fetchPRs}
          disabled={listLoading || !repo}
          title="Refresh"
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40 px-1"
        >
          ↻
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {tabBtn('list', 'List')}
        {tabBtn('detail', 'Detail')}
        {tabBtn('create', 'Create')}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── List tab ── */}
        {tab === 'list' && (
          <div className="p-3 flex flex-col gap-3">
            {/* Repo input */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Repository
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchPRs()}
                  placeholder="owner/repo"
                  className="flex-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400"
                />
                <button
                  onClick={fetchPRs}
                  disabled={listLoading || !repo.trim()}
                  className="px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                >
                  Load
                </button>
              </div>
            </div>

            {/* State toggle */}
            <div className="flex gap-1">
              {(['open', 'closed', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPrState(s)}
                  className={`px-2.5 py-1 text-xs rounded capitalize transition-colors ${
                    prState === s
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {listError && (
              <div className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded p-2">
                {listError}
              </div>
            )}

            {listLoading && (
              <div className="text-xs text-center text-gray-400 animate-pulse py-4">
                Loading…
              </div>
            )}

            {!listLoading && !listError && prs.length === 0 && repo && (
              <div className="text-xs text-center text-gray-400 py-4">No PRs found</div>
            )}

            {!listLoading &&
              prs.map((pr) => (
                <button
                  key={pr.number}
                  onClick={() => openDetail(pr)}
                  className="w-full text-left p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 shrink-0 mt-0.5 font-mono">
                      #{pr.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                        {pr.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <StateTag state={pr.state} isDraft={pr.isDraft} />
                        <span className="text-xs text-gray-400">@{pr.author.login}</span>
                        <span className="text-xs text-gray-400">{formatDate(pr.updatedAt)}</span>
                      </div>
                      {pr.labels.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {pr.labels.map((l) => (
                            <span
                              key={l.name}
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `#${l.color}33`,
                                color: `#${l.color}`,
                              }}
                            >
                              {l.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}

        {/* ── Detail tab ── */}
        {tab === 'detail' && (
          <div className="p-3 flex flex-col gap-3">
            {detailLoading && (
              <div className="text-xs text-center text-gray-400 animate-pulse py-4">
                Loading…
              </div>
            )}

            {!detailLoading && !selectedPR && (
              <div className="text-xs text-center text-gray-400 py-8">
                Select a PR from the List tab
              </div>
            )}

            {!detailLoading && selectedPR && (
              <>
                {/* PR header */}
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <button
                      onClick={() => setTab('list')}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 text-base leading-none"
                      title="Back to list"
                    >
                      ←
                    </button>
                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug">
                      #{selectedPR.number} {selectedPR.title}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-5">
                    <StateTag state={selectedPR.state} isDraft={selectedPR.isDraft} />
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      {selectedPR.headRefName} → {selectedPR.baseRefName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-5 mt-1">
                    <span className="text-xs text-gray-400">@{selectedPR.author.login}</span>
                    <span className="text-xs text-gray-400">{formatDate(selectedPR.createdAt)}</span>
                    {onOpenFile && (
                      <button
                        onClick={handleOpenDiff}
                        className="ml-auto text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300"
                      >
                        Open diff
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                {selectedPR.body?.trim() && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                      Description
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                      <MarkdownBody content={selectedPR.body} />
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Comments ({comments.length})
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {comments.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-2">No comments yet</div>
                    )}
                    {comments.map((c) => (
                      <div key={`${c.type}-${c.id}`} className="flex gap-2">
                        <Avatar login={c.login} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {c.login}
                            </span>
                            {c.type === 'review' && c.state && (
                              <span className="text-xs px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 capitalize">
                                {c.state.toLowerCase().replace('_', ' ')}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                            <MarkdownBody content={c.body} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply box */}
                  <div className="mt-3">
                    <textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Leave a comment…"
                      rows={3}
                      className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400 resize-none"
                    />
                    <div className="flex justify-end mt-1">
                      <button
                        onClick={handleComment}
                        disabled={commentLoading || !commentBody.trim()}
                        className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                      >
                        {commentLoading ? 'Posting…' : 'Comment'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Review section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Review</div>
                  <textarea
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="Review comment (optional)…"
                    rows={3}
                    className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400 resize-none"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      onClick={() => handleReview('APPROVE')}
                      disabled={reviewLoading}
                      className="flex-1 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview('REQUEST_CHANGES')}
                      disabled={reviewLoading}
                      className="flex-1 py-1 text-xs rounded bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                    >
                      Request changes
                    </button>
                    <button
                      onClick={() => handleReview('COMMENT')}
                      disabled={reviewLoading}
                      className="flex-1 py-1 text-xs rounded bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50"
                    >
                      Comment
                    </button>
                  </div>
                </div>

                {/* Action feedback */}
                {actionMsg && (
                  <div
                    className={`text-xs rounded p-2 ${
                      actionMsg.startsWith('Error')
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    }`}
                  >
                    {actionMsg}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Create PR tab ── */}
        {tab === 'create' && (
          <div className="p-3 flex flex-col gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Repository
              </label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Title</label>
              <input
                type="text"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="PR title"
                className={inputCls}
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Head (from)
                </label>
                <input
                  type="text"
                  value={createHead}
                  onChange={(e) => setCreateHead(e.target.value)}
                  placeholder="feature-branch"
                  className={inputCls}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Base (into)
                </label>
                {branches.length > 0 ? (
                  <select
                    value={createBase}
                    onChange={(e) => setCreateBase(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select base…</option>
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={createBase}
                    onChange={(e) => setCreateBase(e.target.value)}
                    placeholder="main"
                    className={inputCls}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Description
              </label>
              <textarea
                value={createBody}
                onChange={(e) => setCreateBody(e.target.value)}
                placeholder="PR description (markdown)…"
                rows={6}
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-400 resize-none"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={
                createLoading ||
                !createTitle.trim() ||
                !createBase ||
                !createHead ||
                !repo.trim()
              }
              className="w-full py-2 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
            >
              {createLoading ? 'Creating…' : 'Create Pull Request'}
            </button>

            {createResult && (
              <div
                className={`text-xs rounded p-2 ${
                  createResult.ok
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                }`}
              >
                {createResult.ok ? (
                  <>
                    PR created!
                    {createResult.url && (
                      <a
                        href={createResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-1 underline break-all"
                      >
                        {createResult.url}
                      </a>
                    )}
                  </>
                ) : (
                  `Error: ${createResult.error}`
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
