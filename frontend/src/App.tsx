import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react'
import { EditorView } from '@codemirror/view'
import { marked } from 'marked'

import { Tab, Theme } from './types'
import TabBar from './components/TabBar'
import Toolbar from './components/Toolbar'
import Editor, { EditorRef, SAMPLE_CONTENT } from './components/Editor'
import Preview, { PreviewRef } from './components/Preview'
import SplitPane from './components/SplitPane'
import FindReplace from './components/FindReplace'
import StatusBar from './components/StatusBar'
import GitPanel from './components/GitPanel'
import GitHubBrowser from './components/GitHubBrowser'

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

  const editorRef = useRef<EditorRef>(null)
  const previewRef = useRef<PreviewRef>(null)
  const scrollSyncRef = useRef(true)
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
      const filePath = await window.electronAPI.showOpenDialog()
      if (!filePath) return
      try {
        const content = await window.electronAPI.readFile(filePath)
        const filename =
          filePath.split('/').pop() ?? filePath.split('\\').pop() ?? 'untitled.md'
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
        alert('Failed to open file: ' + String(e))
      }
    } else {
      fileInputRef.current?.click()
    }
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

    if (window.electronAPI) {
      // Re-use existing path or prompt for one
      const filePath =
        activeTab.filePath ??
        (await window.electronAPI.showSaveDialog(filename))
      if (!filePath) return // user cancelled
      try {
        await window.electronAPI.writeFile(filePath, content)
        const newFilename =
          filePath.split('/').pop() ??
          filePath.split('\\').pop() ??
          filename
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId
              ? { ...t, originalContent: content, filePath, filename: newFilename, isNew: false }
              : t
          )
        )
      } catch (e) {
        alert('Failed to save: ' + String(e))
      }
    } else if ('showSaveFilePicker' in window) {
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
        let content: string
        if (window.electronAPI) {
          const data = await window.electronAPI.fetchUrl(url)
          if (!data.ok) { alert('Failed to load URL: ' + data.error); return }
          content = data.content!
        } else {
          const res = await fetch('/api/fetch-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          })
          const data = await res.json()
          if (!data.ok) { alert('Failed to load URL: ' + data.error); return }
          content = data.content
        }
        const filename = url.split('/').pop() ?? 'fetched.md'
        newTab(filename, content)
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
    },
    []
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
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
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
          onLoadUrl={loadUrl}
        />
      </div>

      {/* Find & Replace */}
      {showFindReplace && (
        <FindReplace
          editorView={editorView}
          onClose={() => setShowFindReplace(false)}
        />
      )}

      {/* Main area: split pane + side panels */}
      <div className="flex flex-1 overflow-hidden" style={{minHeight: 0}}>
        <SplitPane
          left={
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <Editor
                  ref={editorRef}
                  content={activeTab?.content ?? ''}
                  onChange={updateActiveTabContent}
                  theme={theme}
                  fontSize={fontSize}
                  onScrollSync={handleEditorScroll}
                  onViewReady={() => {
                    // force re-render to expose editorView to toolbar
                    // (view is captured via ref)
                  }}
                />
              </div>
            </div>
          }
          right={
            <Preview
              ref={previewRef}
              content={activeTab?.content ?? ''}
              fontSize={fontSize}
            />
          }
        />

        {/* Git panel */}
        {showGit && (
          <GitPanel
            cwd={
              activeTab?.filePath
                ? activeTab.filePath.replace(/\/[^/]+$/, '') || '/'
                : undefined
            }
          />
        )}

        {/* GitHub browser panel */}
        {showGh && <GitHubBrowser onOpenFile={handleGhOpenFile} />}
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
