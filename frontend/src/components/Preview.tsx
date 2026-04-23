import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

export interface PreviewRef {
  scrollTo: (percentage: number) => void
}

interface Props {
  content: string
  fontSize: number
}

// Configure marked with highlight.js via marked-highlight extension
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  })
)

marked.setOptions({ gfm: true, breaks: false })

const Preview = forwardRef<PreviewRef, Props>(function Preview(
  { content, fontSize },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  const html = marked.parse(content) as string

  useImperativeHandle(ref, () => ({
    scrollTo: (percentage: number) => {
      const el = containerRef.current
      if (!el || syncingRef.current) return
      syncingRef.current = true
      const maxScroll = el.scrollHeight - el.clientHeight
      el.scrollTop = percentage * maxScroll
      requestAnimationFrame(() => {
        syncingRef.current = false
      })
    },
  }))

  // Only reset scroll when switching tabs (content changes drastically)
  // Don't reset on every keystroke — that breaks scroll sync
  const prevContentLengthRef = useRef(content.length)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const delta = Math.abs(content.length - prevContentLengthRef.current)
    prevContentLengthRef.current = content.length
    // Reset only if content changed by more than 200 chars (tab switch, not typing)
    if (delta > 200) el.scrollTop = 0
  }, [content])

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      style={{ fontSize }}
    >
      <div
        className="markdown-preview max-w-none prose-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
})

export default Preview
