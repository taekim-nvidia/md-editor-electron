import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react'
import { EditorView } from '@codemirror/view'
import { marked } from 'marked'

import { Tab, Theme } from './types'
import { fetchMarkdownUrl } from './lib/api'
import TabBar from './components/TabBar'
import Toolbar from './components/Toolbar'
import Editor, { EditorRef, SAMPLE_CONTENT } from './components/Editor'
import Preview, { PreviewRef } from './components/Preview'
import WysiwygEditor, { WysiwygEditorRef } from './components/WysiwygEditor'
import SplitPane from './components/SplitPane'
import FindReplace from './components/FindReplace'
import StatusBar from './components/StatusBar'
import GitPanel from './components/GitPanel'
import GitHubBrowser from './components/GitHubBrowser'
import PRPanel from './components/PRPanel'

// ── helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0
function uid() {
  return `tab-${++_idCounter}-${Date.now()}`
}

function makeNewTab(filename = 'untitled.md', content = ''): Tab {
  return {
    id: uid(),
    filename,
    content,
    originalContent: content,
    isNew: true,
  }
}

const STORAGE_THEME_KEY = 'md-editor-theme'
const STORAGE_FONTSIZE_KEY = 'md-editor-fontsize'

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_THEME_KEY)
    return t === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function loadFontSize(): number {
  try {
    const s = localStorage.getItem(STORAGE_FONTSIZE_KEY)
    const n = s ? parseInt(s, 10) : 14
    return Math.min(24, Math.max(10, n))
  } catch {
    return 14
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const initialTab = makeNewTab('welcome.md', SAMPLE_CONTENT)
  initialTab.originalContent = SAMPLE_CONTENT

  const [tabs, setTabs] = useState<Tab[]>([initialTab])
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id)
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [fontSize, setFontSize] = useState<number>(loadFontSize)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showGit, setShowGit] = useState(false)
  const [showGh, setShowGh] = useState(false)
  const [showPr, setShowPr] = useState(false)
  type Layout = 'split-h' | 'split-v' | 'editor' | 'preview'
  const [layout, setLayout] = useState<Layout>('split-h')
  const [editorMode, setEditorMode] = useState<'source' | 'wysiwyg'>('source')

  const editorRef = useRef<EditorRef>(null)
  const previewRef = useRef<PreviewRef>(null)
  const wysiwygRef = useRef<WysiwygEditorRef>(null)
  const scrollSyncRef = useRef(true)
  const isSyncingRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const editorView = editorRef.current?.getView() ?? null

  // ── Theme ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(STORAGE_FONTSIZE_KEY, String(fontSize))
  }, [fontSize])

  // Auto-save on commit only (no timer)

  // ── Tab helpers ────────────────────────────────────────────────────────────
  const updateActiveTabContent = useCallback(
    (content: string) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, content } : t))
      )
    },
    [activeTabId]
  )

  const newTab = useCallback((filename = 'untitled.md', content = '') => {
    const tab = makeNewTab(filename, content)
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
    return tab
  }, [])

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id)
        if (next.length === 0) {
          const fresh = makeNewTab()
          setActiveTabId(fresh.id)
          return [fresh]
        }
        if (id === activeTabId) {
          const idx = prev.findIndex((t) => t.id === id)
          const fallback = next[Math.max(0, idx - 1)]
          setActiveTabId(fallback.id)
        }
        return next
      })
    },
    [activeTabId]
  )

  // ── File open ─────────────────────────────────────────────────────────────
  const openFileDialog = async () => {
    if (window.electronAPI) {
      const paths = await window.electronAPI.showOpenDialog()
      if (!paths || paths.length === 0) return
      const filePath = paths[0]
      try {
        const content = await window.electronAPI.readFile(filePath)
        const filename = filePath.split('/').pop() ?? 'file.md'
        const existing = tabs.find((t) => t.filePath === filePath)
        if (existing) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === existing.id
                ? { ...t, content, originalContent: content, isNew: false }
                : t
            )
          )
          setActiveTabId(existing.id)
        } else {
          const tab = makeNewTab(filename, content)
          tab.originalContent = content
          tab.filePath = filePath
          tab.isNew = false
          setTabs((prev) => [...prev, tab])
          setActiveTabId(tab.id)
        }
      } catch (e) {
        alert('Error opening file: ' + String(e))
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = (ev.target?.result as string) ?? ''
      const existing = tabs.find((t) => t.filename === file.name)
      if (existing) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === existing.id
              ? { ...t, content, originalContent: content, isNew: false }
              : t
          )
        )
        setActiveTabId(existing.id)
      } else {
        const tab = makeNewTab(file.name, content)
        tab.originalContent = content
        tab.isNew = false
        setTabs((prev) => [...prev, tab])
        setActiveTabId(tab.id)
      }
    }
    reader.readAsText(file)
    // Reset so same file can be reopened
    e.target.value = ''
  }

  // ── File save ─────────────────────────────────────────────────────────────
  const saveCurrentTab = useCallback(async () => {
    if (!activeTab) return
    const content = activeTab.content
    const filename = activeTab.filename

    // Electron: use native dialog / direct write
    if (window.electronAPI) {
      if (activeTab.filePath) {
        try {
          await window.electronAPI.writeFile(activeTab.filePath, content)
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTabId ? { ...t, originalContent: content } : t))
          )
        } catch (e) {
          alert('Save failed: ' + String(e))
        }
        return
      }
      const savePath = await window.electronAPI.showSaveDialog(filename)
      if (savePath) {
        try {
          await window.electronAPI.writeFile(savePath, content)
          const savedFilename = savePath.split('/').pop() ?? filename
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId
                ? { ...t, originalContent: content, filePath: savePath, filename: savedFilename, isNew: false }
                : t
            )
          )
        } catch (e) {
          alert('Save failed: ' + String(e))
        }
      }
      return
    }

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Markdown',
              accept: { 'text/markdown': ['.md', '.markdown'] },
            },
            { description: 'Text', accept: { 'text/plain': ['.txt'] } },
          ],
        })
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        // Mark as saved
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId ? { ...t, originalContent: content } : t
          )
        )
      } catch {
        // User cancelled
      }
    } else {
      // Fallback: download
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, originalContent: content } : t
        )
      )
    }
  }, [activeTab, activeTabId])

  // ── HTML export ───────────────────────────────────────────────────────────
  const exportHtml = useCallback(() => {
    if (!activeTab) return
    const body = marked.parse(activeTab.content) as string
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${activeTab.filename}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown-light.min.css" />
  <style>
    body { max-width: 860px; margin: 2rem auto; padding: 0 1rem; font-family: -apple-system, sans-serif; }
  </style>
</head>
<body class="markdown-body">
${body}
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeTab.filename.replace(/\.md$/, '.html')
    a.click()
    URL.revokeObjectURL(url)
  }, [activeTab])

  // ── URL loader ────────────────────────────────────────────────────────────
  const loadUrl = useCallback(
    async (url: string) => {
      try {
        const data = await fetchMarkdownUrl(url)
        if (data.ok) {
          const filename = url.split('/').pop() ?? 'fetched.md'
          newTab(filename, data.content)
        } else {
          alert('Failed to load URL: ' + data.error)
        }
      } catch (e) {
        alert('Network error: ' + String(e))
      }
    },
    [newTab]
  )

  // ── Scroll sync ───────────────────────────────────────────────────────────
  const handleEditorScroll = useCallback(
    (scrollTop: number, scrollHeight: number, clientHeight: number) => {
      if (!scrollSyncRef.current) return
      const maxScroll = scrollHeight - clientHeight
      if (maxScroll <= 0) return
      previewRef.current?.scrollTo(scrollTop / maxScroll)
      wysiwygRef.current?.scrollTo(scrollTop / maxScroll)
    },
    []
  )

  // ── CodeMirror → Tiptap sync ──────────────────────────────────────────────
  const handleEditorChange = useCallback(
    (content: string) => {
      updateActiveTabContent(content)
      if (isSyncingRef.current) return
      isSyncingRef.current = true
      wysiwygRef.current?.setMarkdown(content)
      isSyncingRef.current = false
    },
    [updateActiveTabContent]
  )

  // ── Tiptap → CodeMirror sync (debounced 300ms) ────────────────────────────
  const handleWysiwygChange = useCallback(
    (markdown: string) => {
      if (isSyncingRef.current) return
      updateActiveTabContent(markdown)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        isSyncingRef.current = true
        const view = editorRef.current?.getView()
        if (view) {
          const current = view.state.doc.toString()
          if (current !== markdown) {
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: markdown },
            })
          }
        }
        isSyncingRef.current = false
      }, 300)
    },
    [updateActiveTabContent]
  )

  // ── GitHub browser: open file ─────────────────────────────────────────────
  const handleGhOpenFile = useCallback(
    (filename: string, content: string, path: string) => {
      const existing = tabs.find((t) => t.filePath === path)
      if (existing) {
        setActiveTabId(existing.id)
      } else {
        const tab = makeNewTab(filename, content)
        tab.originalContent = content
        tab.filePath = path
        tab.isNew = false
        setTabs((prev) => [...prev, tab])
        setActiveTabId(tab.id)
      }
    },
    [tabs]
  )

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 's') {
        e.preventDefault()
        saveCurrentTab()
        return
      }
      if (ctrl && e.key === 'f') {
        e.preventDefault()
        setShowFindReplace((v) => !v)
        return
      }
      if (ctrl && e.key === 'n') {
        e.preventDefault()
        newTab()
        return
      }
      if (ctrl && e.key === 'b') {
        e.preventDefault()
        const view = editorRef.current?.getView()
        if (view) {
          const { state } = view
          const sel = state.selection.main
          if (sel.empty) {
            view.dispatch({
              changes: { from: sel.from, insert: '**text**' },
              selection: { anchor: sel.from + 2, head: sel.from + 6 },
            })
          } else {
            const text = state.doc.sliceString(sel.from, sel.to)
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: `**${text}**` },
              selection: { anchor: sel.from + 2, head: sel.from + 2 + text.length },
            })
          }
          view.focus()
        }
        return
      }
      if (ctrl && e.key === 'i') {
        e.preventDefault()
        const view = editorRef.current?.getView()
        if (view) {
          const { state } = view
          const sel = state.selection.main
          if (sel.empty) {
            view.dispatch({
              changes: { from: sel.from, insert: '_text_' },
              selection: { anchor: sel.from + 1, head: sel.from + 5 },
            })
          } else {
            const text = state.doc.sliceString(sel.from, sel.to)
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: `_${text}_` },
              selection: { anchor: sel.from + 1, head: sel.from + 1 + text.length },
            })
          }
          view.focus()
        }
        return
      }
      // Font size: Ctrl+= or Ctrl++ (shift+=) to increase, Ctrl+- to decrease, Ctrl+0 reset
      if (ctrl && (e.key === '=' || e.key === '+' || (e.shiftKey && e.key === '='))) {
        e.preventDefault()
        e.stopPropagation()
        setFontSize((s) => Math.min(s + 2, 32))
        return
      }
      if (ctrl && e.key === '-') {
        e.preventDefault()
        e.stopPropagation()
        setFontSize((s) => Math.max(s - 2, 10))
        return
      }
      if (ctrl && e.key === '0') {
        e.preventDefault()
        e.stopPropagation()
        setFontSize(14)
        return
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [saveCurrentTab, newTab])

  // ── Theme / font toggles ─────────────────────────────────────────────────
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  const increaseFontSize = () => setFontSize((n) => Math.min(24, n + 1))
  const decreaseFontSize = () => setFontSize((n) => Math.max(10, n - 1))

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className={`flex flex-col h-screen ${
        theme === 'dark' ? 'dark bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
      } overflow-hidden`}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Tab bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onClose={closeTab}
        onNew={() => newTab()}
      />

      {/* Toolbar */}
      <div className="relative">
        <Toolbar
          editorView={editorView}
          wysiwygRef={wysiwygRef}
          theme={theme}
          onThemeToggle={toggleTheme}
          onNew={() => newTab()}
          onOpen={openFileDialog}
          onSave={saveCurrentTab}
          onHtmlExport={exportHtml}
          onFindReplace={() => setShowFindReplace((v) => !v)}
          showFindReplace={showFindReplace}
          onGitToggle={() => setShowGit((v) => !v)}
          showGit={showGit}
          onGhToggle={() => setShowGh((v) => !v)}
          showGh={showGh}
          onPrToggle={() => setShowPr((v) => !v)}
          showPr={showPr}
          onLoadUrl={loadUrl}
          layout={layout}
          onLayoutChange={setLayout}
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
        />
      </div>

      {/* Find & Replace */}
      {showFindReplace && (
        <FindReplace
          editorView={editorMode === 'wysiwyg' ? null : editorView}
          wysiwygRef={editorMode === 'wysiwyg' ? wysiwygRef : undefined}
          onClose={() => setShowFindReplace(false)}
        />
      )}

      {/* Main area: split pane + side panels */}
      <div className="flex flex-1 overflow-hidden" style={{minHeight: 0}}>
        {/* Layout: split-h | split-v | editor | preview — plus editorMode */}
        {editorMode === 'wysiwyg' ? (
          <div className="flex-1 overflow-hidden">
            <WysiwygEditor
              key={activeTabId}
              ref={wysiwygRef}
              content={activeTab?.content ?? ''}
              onChange={handleWysiwygChange}
              theme={theme}
              fontSize={fontSize}
            />
          </div>
        ) : layout === 'editor' ? (
          <div className="flex-1 overflow-hidden">
            <Editor
              key={activeTabId}
              ref={editorRef}
              content={activeTab?.content ?? ''}
              onChange={handleEditorChange}
              theme={theme}
              fontSize={fontSize}
              onScrollSync={handleEditorScroll}
              onViewReady={() => {}}
            />
          </div>
        ) : layout === 'preview' ? (
          <div className="flex-1 overflow-hidden">
            <Preview
              ref={previewRef}
              content={activeTab?.content ?? ''}
              fontSize={fontSize}
            />
          </div>
        ) : (
          <SplitPane
            direction={layout === 'split-v' ? 'vertical' : 'horizontal'}
            left={
              <div className="h-full flex flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <Editor
                    key={activeTabId}
                    ref={editorRef}
                    content={activeTab?.content ?? ''}
                    onChange={handleEditorChange}
                    theme={theme}
                    fontSize={fontSize}
                    onScrollSync={handleEditorScroll}
                    onViewReady={() => {}}
                  />
                </div>
              </div>
            }
            right={
              <WysiwygEditor
                key={activeTabId}
                ref={wysiwygRef}
                content={activeTab?.content ?? ''}
                onChange={handleWysiwygChange}
                theme={theme}
                fontSize={fontSize}
              />
            }
          />
        )}

        {/* Git panel */}
        {showGit && (
          <GitPanel
            cwd={
              activeTab?.filePath
                ? activeTab.filePath.replace(/\/[^/]+$/, '') || '/'
                : undefined
            }
            onSave={saveCurrentTab}
          />
        )}

        {/* GitHub browser panel */}
        {showGh && <GitHubBrowser onOpenFile={handleGhOpenFile} />}

        {/* PR panel */}
        {showPr && (
          <PRPanel
            cwd={
              activeTab?.filePath
                ? activeTab.filePath.replace(/\/[^/]+$/, '') || '/'
                : undefined
            }
            onOpenFile={handleGhOpenFile}
          />
        )}
      </div>

      {/* Status bar */}
      <StatusBar
        activeTab={activeTab}
        fontSize={fontSize}
        onFontSizeIncrease={increaseFontSize}
        onFontSizeDecrease={decreaseFontSize}
      />
    </div>
  )
}
