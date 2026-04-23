import React, { useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { Theme } from '../types'

interface Props {
  editorView: EditorView | null
  theme: Theme
  onThemeToggle: () => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onHtmlExport: () => void
  onFindReplace: () => void
  showFindReplace: boolean
  onGitToggle: () => void
  showGit: boolean
  onGhToggle: () => void
  showGh: boolean
  onPrToggle: () => void
  showPr: boolean
  onLoadUrl: (url: string) => void
  layout: 'split-h' | 'split-v' | 'editor' | 'preview'
  onLayoutChange: (l: 'split-h' | 'split-v' | 'editor' | 'preview') => void
  editorMode: 'source' | 'wysiwyg'
  onEditorModeChange: (mode: 'source' | 'wysiwyg') => void
}

function wrapSelection(view: EditorView, before: string, after: string) {
  const { state } = view
  const changes = state.changeByRange((range) => {
    if (range.empty) {
      const placeholder = 'text'
      return {
        changes: [{ from: range.from, insert: before + placeholder + after }],
        range: EditorSelection.range(
          range.from + before.length,
          range.from + before.length + placeholder.length
        ),
      }
    }
    const selectedText = state.doc.sliceString(range.from, range.to)
    return {
      changes: [{ from: range.from, to: range.to, insert: before + selectedText + after }],
      range: EditorSelection.range(
        range.from + before.length,
        range.from + before.length + selectedText.length
      ),
    }
  })
  view.dispatch(changes)
  view.focus()
}

function insertLinePrefix(view: EditorView, prefix: string) {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.from)
  const lineText = line.text
  if (lineText.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
      selection: { anchor: state.selection.main.from - prefix.length },
    })
  } else {
    view.dispatch({
      changes: { from: line.from, insert: prefix },
      selection: { anchor: state.selection.main.from + prefix.length },
    })
  }
  view.focus()
}

function insertCodeBlock(view: EditorView) {
  const { state } = view
  const range = state.selection.main
  if (range.empty) {
    const insert = '```\ncode here\n```\n'
    view.dispatch({
      changes: { from: range.from, insert },
      selection: { anchor: range.from + 4, head: range.from + 13 },
    })
  } else {
    const selected = state.doc.sliceString(range.from, range.to)
    const insert = '```\n' + selected + '\n```'
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: { anchor: range.from + 4, head: range.from + 4 + selected.length },
    })
  }
  view.focus()
}

function ToolBtn({
  title,
  onClick,
  active,
  children,
  className = '',
}: {
  title: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`
        px-2 py-1 rounded text-sm font-medium transition-colors
        ${
          active
            ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }
        ${className}
      `}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
}

export default function Toolbar({
  editorView,
  theme,
  onThemeToggle,
  onNew,
  onOpen,
  onSave,
  onHtmlExport,
  onFindReplace,
  showFindReplace,
  onGitToggle,
  showGit,
  onGhToggle,
  showGh,
  onPrToggle,
  showPr,
  onLoadUrl,
  layout,
  onLayoutChange,
  editorMode,
  onEditorModeChange,
}: Props) {
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const bold = () => editorView && wrapSelection(editorView, '**', '**')
  const italic = () => editorView && wrapSelection(editorView, '_', '_')
  const code = () => editorView && wrapSelection(editorView, '`', '`')
  const h1 = () => editorView && insertLinePrefix(editorView, '# ')
  const h2 = () => editorView && insertLinePrefix(editorView, '## ')
  const codeBlock = () => editorView && insertCodeBlock(editorView)

  const submitUrl = () => {
    if (urlInput.trim()) {
      onLoadUrl(urlInput.trim())
      setUrlInput('')
      setUrlDialogOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap shrink-0">
      {/* File ops */}
      <ToolBtn title="New (Ctrl+N)" onClick={onNew}>New</ToolBtn>
      <ToolBtn title="Open file" onClick={onOpen}>Open</ToolBtn>
      <ToolBtn title="Save (Ctrl+S)" onClick={onSave}>Save</ToolBtn>
      <Divider />

      {/* Format */}
      <ToolBtn title="Bold (Ctrl+B)" onClick={bold} className="font-bold">B</ToolBtn>
      <ToolBtn title="Italic (Ctrl+I)" onClick={italic} className="italic">I</ToolBtn>
      <ToolBtn title="Inline code" onClick={code} className="font-mono">`</ToolBtn>
      <ToolBtn title="Heading 1" onClick={h1}>H1</ToolBtn>
      <ToolBtn title="Heading 2" onClick={h2}>H2</ToolBtn>
      <ToolBtn title="Code block" onClick={codeBlock} className="font-mono">{"{ }"}</ToolBtn>
      <Divider />

      {/* Panels */}
      <ToolBtn
        title="Find & Replace (Ctrl+F)"
        onClick={onFindReplace}
        active={showFindReplace}
      >
        Find
      </ToolBtn>
      <ToolBtn title="Git panel" onClick={onGitToggle} active={showGit}>Git</ToolBtn>
      <ToolBtn title="GitHub browser" onClick={onGhToggle} active={showGh}>GH</ToolBtn>
      <ToolBtn title="Pull Requests" onClick={onPrToggle} active={showPr}>PR</ToolBtn>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Layout toggles */}
      {/* Split horizontal: two side-by-side rectangles with a vertical line */}
      <ToolBtn title="Split left/right" onClick={() => onLayoutChange('split-h')} active={layout === 'split-h'}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="2" width="5" height="12" rx="1" opacity="0.9"/>
          <rect x="7.5" y="2" width="1" height="12"/>
          <rect x="10" y="2" width="5" height="12" rx="1" opacity="0.9"/>
        </svg>
      </ToolBtn>
      {/* Split vertical: two stacked rectangles with a horizontal line */}
      <ToolBtn title="Split top/bottom" onClick={() => onLayoutChange('split-v')} active={layout === 'split-v'}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="1" width="12" height="5" rx="1" opacity="0.9"/>
          <rect x="2" y="7.5" width="12" height="1"/>
          <rect x="2" y="10" width="12" height="5" rx="1" opacity="0.9"/>
        </svg>
      </ToolBtn>
      {/* Editor only: single rectangle left-aligned */}
      <ToolBtn title="Editor only" onClick={() => onLayoutChange('editor')} active={layout === 'editor'}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="2" width="14" height="12" rx="1" opacity="0.9"/>
          <line x1="3" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
          <line x1="3" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
        </svg>
      </ToolBtn>
      {/* Preview only: single rectangle with rendered look */}
      <ToolBtn title="Preview only" onClick={() => onLayoutChange('preview')} active={layout === 'preview'}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="2" width="14" height="12" rx="1" opacity="0.9"/>
          <rect x="3" y="5" width="4" height="1.5" rx="0.5" opacity="0.4"/>
          <rect x="3" y="8" width="10" height="1" rx="0.5" opacity="0.4"/>
          <rect x="3" y="10.5" width="8" height="1" rx="0.5" opacity="0.4"/>
        </svg>
      </ToolBtn>
      <Divider />

      {/* Editor mode toggle */}
      <ToolBtn
        title="Source mode: CodeMirror + WYSIWYG side by side"
        onClick={() => onEditorModeChange('source')}
        active={editorMode === 'source'}
      >
        Source
      </ToolBtn>
      <ToolBtn
        title="WYSIWYG mode: full-width rich text editor"
        onClick={() => onEditorModeChange('wysiwyg')}
        active={editorMode === 'wysiwyg'}
      >
        WYSIWYG
      </ToolBtn>
      <Divider />

      {/* URL loader */}
      <ToolBtn title="Load from GitHub URL" onClick={() => setUrlDialogOpen((v) => !v)}>
        URL
      </ToolBtn>

      {/* HTML export */}
      <ToolBtn title="Export as HTML" onClick={onHtmlExport}>HTML</ToolBtn>
      <Divider />

      {/* Theme */}
      <ToolBtn title="Toggle dark/light theme" onClick={onThemeToggle}>
        {theme === 'dark' ? '☀' : '☾'}
      </ToolBtn>

      {/* URL input dialog */}
      {urlDialogOpen && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 w-[480px] flex flex-col gap-3">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Load from GitHub URL
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Paste a github.com file URL (blob link) or a raw.githubusercontent.com URL.
          </div>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitUrl()
              if (e.key === 'Escape') setUrlDialogOpen(false)
            }}
            placeholder="https://github.com/owner/repo/blob/main/README.md"
            autoFocus
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-indigo-400"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setUrlDialogOpen(false)}
              className="px-3 py-1.5 text-sm rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={submitUrl}
              className="px-3 py-1.5 text-sm rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              Load
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
