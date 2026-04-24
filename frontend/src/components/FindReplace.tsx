import React, { useState, useCallback, useEffect } from 'react'
import { EditorView } from '@codemirror/view'
import {
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
} from '@codemirror/search'
import type { WysiwygEditorRef } from './WysiwygEditor'

interface Props {
  editorView: EditorView | null
  wysiwygRef?: React.RefObject<WysiwygEditorRef | null>
  onClose: () => void
}

export default function FindReplace({ editorView, wysiwygRef, onClose }: Props) {
  const [searchText, setSearchText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [matchCount, setMatchCount] = useState<number | null>(null)

  const applyQuery = useCallback(
    (search: string, cs: boolean, regex: boolean) => {
      if (wysiwygRef?.current) {
        setMatchCount(wysiwygRef.current.countMatches(search, cs))
        return
      }
      if (!editorView) return
      if (!search) {
        editorView.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) })
        setMatchCount(null)
        return
      }
      const query = new SearchQuery({
        search,
        caseSensitive: cs,
        regexp: regex,
        replace: replaceText,
      })
      editorView.dispatch({ effects: setSearchQuery.of(query) })

      // Count matches
      const doc = editorView.state.doc.toString()
      try {
        const flags = cs ? 'g' : 'gi'
        const pattern = regex ? search : search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const matches = doc.match(new RegExp(pattern, flags))
        setMatchCount(matches ? matches.length : 0)
      } catch {
        setMatchCount(null)
      }
    },
    [editorView, replaceText]
  )

  useEffect(() => {
    applyQuery(searchText, caseSensitive, useRegex)
  }, [searchText, caseSensitive, useRegex, applyQuery])

  const handleFindNext = () => {
    if (wysiwygRef?.current) {
      const count = wysiwygRef.current.findNext(searchText, caseSensitive)
      setMatchCount(count)
    } else if (editorView) {
      findNext(editorView)
      editorView.focus()
    }
  }

  const handleFindPrev = () => {
    if (wysiwygRef?.current) {
      const count = wysiwygRef.current.findPrev(searchText, caseSensitive)
      setMatchCount(count)
    } else if (editorView) {
      findPrevious(editorView)
      editorView.focus()
    }
  }

  const handleReplaceNext = () => {
    if (wysiwygRef?.current) {
      wysiwygRef.current.replaceNext(searchText, replaceText, caseSensitive)
      const count = wysiwygRef.current.countMatches(searchText, caseSensitive)
      setMatchCount(count)
    } else if (editorView) {
      const query = new SearchQuery({ search: searchText, caseSensitive, regexp: useRegex, replace: replaceText })
      editorView.dispatch({ effects: setSearchQuery.of(query) })
      replaceNext(editorView)
      applyQuery(searchText, caseSensitive, useRegex)
    }
  }

  const handleReplaceAll = () => {
    if (wysiwygRef?.current) {
      wysiwygRef.current.replaceAll(searchText, replaceText, caseSensitive)
      setMatchCount(0)
    } else if (editorView) {
      const query = new SearchQuery({ search: searchText, caseSensitive, regexp: useRegex, replace: replaceText })
      editorView.dispatch({ effects: setSearchQuery.of(query) })
      replaceAll(editorView)
      applyQuery(searchText, caseSensitive, useRegex)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && !e.shiftKey) handleFindNext()
    if (e.key === 'Enter' && e.shiftKey) handleFindPrev()
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm shrink-0 flex-wrap">
      {/* Find section */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find…"
          autoFocus
          className="w-44 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-indigo-400"
        />
        {matchCount !== null && searchText && (
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {matchCount} match{matchCount !== 1 ? 'es' : ''}
          </span>
        )}
        <button
          onClick={handleFindPrev}
          className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"
          title="Previous (Shift+Enter)"
        >
          ↑
        </button>
        <button
          onClick={handleFindNext}
          className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"
          title="Next (Enter)"
        >
          ↓
        </button>
      </div>

      {/* Replace section */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Replace…"
          className="w-44 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-indigo-400"
        />
        <button
          onClick={handleReplaceNext}
          className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 whitespace-nowrap"
          title="Replace next"
        >
          Replace
        </button>
        <button
          onClick={handleReplaceAll}
          className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 whitespace-nowrap"
          title="Replace all"
        >
          All
        </button>
      </div>

      {/* Options */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 cursor-pointer text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            className="accent-indigo-500"
          />
          Aa
        </label>
        <label className="flex items-center gap-1 cursor-pointer text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(e) => setUseRegex(e.target.checked)}
            className="accent-indigo-500"
          />
          .*
        </label>
      </div>

      <button
        onClick={onClose}
        className="ml-auto text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none px-1"
        title="Close (Esc)"
      >
        ×
      </button>
    </div>
  )
}
