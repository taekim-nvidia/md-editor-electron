import React, {
  useEffect,
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
  // Format commands
  toggleBold: () => void
  toggleItalic: () => void
  toggleCode: () => void
  setHeading: (level: 1 | 2 | 3) => void
  toggleCodeBlock: () => void
  // Find & Replace
  findNext: (text: string, caseSensitive: boolean) => number
  findPrev: (text: string, caseSensitive: boolean) => number
  replaceNext: (find: string, replace: string, caseSensitive: boolean) => void
  replaceAll: (find: string, replace: string, caseSensitive: boolean) => void
  countMatches: (text: string, caseSensitive: boolean) => number
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

    // Track last content set from outside to avoid re-setting same content
    const lastExternalContent = useRef(content)

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

    // Sync content prop → Tiptap when it changes (e.g. new tab opened, URL loaded)
    useEffect(() => {
      console.log('[WysiwygEditor] content prop changed, length:', content.length)
      if (!editor) { console.log('[WysiwygEditor] editor not ready'); return }
      if (content === lastExternalContent.current) { console.log('[WysiwygEditor] same content, skip'); return }
      lastExternalContent.current = content
      const current = editor.getMarkdown()
      if (current === content) { console.log('[WysiwygEditor] already matches, skip'); return }
      console.log('[WysiwygEditor] setting content...')
      isSettingContent.current = true
      editor.commands.setContent(content, { contentType: 'markdown' })
      isSettingContent.current = false
      console.log('[WysiwygEditor] content set done')
    }, [editor, content])

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
        toggleBold:      () => editor?.chain().focus().toggleBold().run(),
        // Find & Replace using editor text content
        findNext: (text: string, cs: boolean) => {
          if (!editor || !text) return 0
          const content = editor.getText()
          const flags = cs ? 'g' : 'gi'
          const matches = [...content.matchAll(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags))]
          // Use browser find as visual highlight
          if ((window as any).find) (window as any).find(text, cs, false, true, false, false, false)
          return matches.length
        },
        findPrev: (text: string, cs: boolean) => {
          if (!editor || !text) return 0
          const content = editor.getText()
          const flags = cs ? 'g' : 'gi'
          const matches = [...content.matchAll(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags))]
          if ((window as any).find) (window as any).find(text, cs, true, true, false, false, false)
          return matches.length
        },
        replaceNext: (find: string, replace: string, cs: boolean) => {
          if (!editor || !find) return
          const md = editor.getMarkdown()
          const idx = cs ? md.indexOf(find) : md.toLowerCase().indexOf(find.toLowerCase())
          if (idx === -1) return
          const newMd = md.slice(0, idx) + replace + md.slice(idx + find.length)
          editor.commands.setContent(newMd, { contentType: 'markdown' })
        },
        replaceAll: (find: string, replace: string, cs: boolean) => {
          if (!editor || !find) return
          const md = editor.getMarkdown()
          const flags = cs ? 'g' : 'gi'
          const newMd = md.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags), replace)
          editor.commands.setContent(newMd, { contentType: 'markdown' })
        },
        countMatches: (text: string, cs: boolean) => {
          if (!editor || !text) return 0
          const doc = editor.getText()
          const flags = cs ? 'g' : 'gi'
          try {
            return [...doc.matchAll(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags))].length
          } catch { return 0 }
        },
        toggleItalic:    () => editor?.chain().focus().toggleItalic().run(),
        toggleCode:      () => editor?.chain().focus().toggleCode().run(),
        setHeading:      (level: 1|2|3) => editor?.chain().focus().toggleHeading({ level }).run(),
        toggleCodeBlock: () => editor?.chain().focus().toggleCodeBlock().run(),
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
