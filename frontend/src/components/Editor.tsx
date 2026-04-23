import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  dropCursor,
} from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  highlightSelectionMatches,
  searchKeymap,
} from '@codemirror/search'
import {
  bracketMatching,
  indentOnInput,
  foldGutter,
} from '@codemirror/language'
import { Theme } from '../types'

export interface EditorRef {
  getView: () => EditorView | null
  focus: () => void
  setContent: (content: string) => void
}

interface Props {
  content: string
  onChange: (content: string) => void
  theme: Theme
  fontSize: number
  onScrollSync?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void
  onViewReady?: (view: EditorView) => void
}

const SAMPLE_CONTENT = `# Welcome to MD Editor

A feature-rich **Markdown** editor with live preview.

## Features

- Split pane with live preview
- CodeMirror 6 syntax highlighting
- Multi-tab support
- Dark/light theme
- Git integration
- GitHub browser

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Ctrl+S\` | Save |
| \`Ctrl+B\` | Bold |
| \`Ctrl+I\` | Italic |
| \`Ctrl+F\` | Find & Replace |
| \`Ctrl+Z\` | Undo |

## Code Example

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}

console.log(greet('World'))
\`\`\`

> Tip: Drag the divider to resize the panes.
`

export { SAMPLE_CONTENT }

const Editor = forwardRef<EditorRef, Props>(function Editor(
  { content, onChange, theme, fontSize, onScrollSync, onViewReady },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Track last externally-set content to avoid update loops
  const externalContentRef = useRef<string>(content)
  // Use a ref for onScrollSync so extensions don't capture stale closure
  const onScrollSyncRef = useRef(onScrollSync)
  useEffect(() => { onScrollSyncRef.current = onScrollSync }, [onScrollSync])

  const buildExtensions = useCallback(
    (currentTheme: Theme) => [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      foldGutter(),
      dropCursor(),
      bracketMatching(),
      indentOnInput(),
      highlightSelectionMatches(),
      history(),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),
      ...(currentTheme === 'dark' ? [oneDark] : []),
      EditorView.theme({
        '&': { fontSize: `${fontSize}px` },
        '.cm-content': { padding: '12px 0' },
        '.cm-gutters': {
          background: currentTheme === 'dark' ? '#282c34' : '#f8f9fa',
          border: 'none',
        },
      }),
      keymap.of([
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newContent = update.state.doc.toString()
          externalContentRef.current = newContent
          onChange(newContent)
        }
      }),
      EditorView.domEventHandlers({
        scroll: (_event, view) => {
          const { scrollTop, scrollHeight, clientHeight } = view.scrollDOM
          onScrollSyncRef.current?.(scrollTop, scrollHeight, clientHeight)
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, fontSize]
  )

  // (Re)create editor when theme or font size changes
  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: externalContentRef.current,
      extensions: buildExtensions(theme),
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view
    onViewReady?.(view)

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, fontSize])

  // Update content when switching tabs (external change)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== content) {
      externalContentRef.current = content
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
      })
    }
  }, [content])

  useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
    focus: () => viewRef.current?.focus(),
    setContent: (c: string) => {
      const view = viewRef.current
      if (!view) return
      externalContentRef.current = c
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: c },
      })
    },
  }))

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden flex flex-col"
      style={{ fontSize }}
    />
  )
})

export default Editor
