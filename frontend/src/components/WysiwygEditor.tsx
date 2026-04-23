import React, {
  useImperativeHandle,
  forwardRef,
  useRef,
} from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'

const lowlight = createLowlight(common)

export interface WysiwygEditorRef {
  setMarkdown: (md: string) => void
  getMarkdown: () => string
  scrollTo: (percentage: number) => void
}

interface Props {
  content: string
  onChange: (markdown: string) => void
  theme: 'dark' | 'light'
  fontSize: number
}

const WysiwygEditor = forwardRef<WysiwygEditorRef, Props>(
  function WysiwygEditor({ content, onChange, fontSize }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const isSettingContent = useRef(false)
    // Use ref so onUpdate always sees the latest onChange without being a dep
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    const editor = useEditor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        Markdown,
        Highlight.configure({ multicolor: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        CodeBlockLowlight.configure({ lowlight }),
      ],
      content,
      contentType: 'markdown',
      editorProps: {
        attributes: {
          class: 'markdown-preview wysiwyg-prosemirror',
        },
      },
      onUpdate: ({ editor }) => {
        if (isSettingContent.current) return
        onChangeRef.current(editor.getMarkdown())
      },
    })

    useImperativeHandle(
      ref,
      () => ({
        setMarkdown: (md: string) => {
          if (!editor) return
          const current = editor.getMarkdown()
          if (current === md) return
          isSettingContent.current = true
          editor.commands.setContent(md, { contentType: 'markdown' })
          isSettingContent.current = false
        },
        getMarkdown: () => {
          if (!editor) return ''
          return editor.getMarkdown()
        },
        scrollTo: (percentage: number) => {
          const el = containerRef.current
          if (!el) return
          const maxScroll = el.scrollHeight - el.clientHeight
          el.scrollTop = percentage * maxScroll
        },
      }),
      [editor]
    )

    return (
      <div
        ref={containerRef}
        className="h-full overflow-y-auto p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        style={{ fontSize }}
      >
        <EditorContent editor={editor} className="max-w-none" />
      </div>
    )
  }
)

export default WysiwygEditor
