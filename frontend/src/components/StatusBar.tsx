import React from 'react'
import { Tab } from '../types'

interface Props {
  activeTab: Tab | undefined
  fontSize: number
  onFontSizeIncrease: () => void
  onFontSizeDecrease: () => void
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

function countLines(text: string): number {
  return text === '' ? 1 : text.split('\n').length
}

export default function StatusBar({
  activeTab,
  fontSize,
  onFontSizeIncrease,
  onFontSizeDecrease,
}: Props) {
  const content = activeTab?.content ?? ''
  const words = countWords(content)
  const lines = countLines(content)
  const chars = content.length
  const modified = activeTab ? activeTab.content !== activeTab.originalContent : false

  return (
    <div className="flex items-center justify-between px-3 py-1 text-xs bg-indigo-600 dark:bg-indigo-800 text-white shrink-0 select-none">
      <div className="flex items-center gap-3">
        <span className="font-medium truncate max-w-[200px]" title={activeTab?.filePath}>
          {activeTab?.filename ?? 'No file'}
        </span>
        {modified && (
          <span className="bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded text-xs font-medium">
            Modified
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span>{lines} lines</span>
        <span>{words} words</span>
        <span>{chars} chars</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onFontSizeDecrease}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-indigo-500 dark:hover:bg-indigo-700"
            title="Decrease font size"
          >
            A-
          </button>
          <span>{fontSize}px</span>
          <button
            onClick={onFontSizeIncrease}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-indigo-500 dark:hover:bg-indigo-700"
            title="Increase font size"
          >
            A+
          </button>
        </div>
      </div>
    </div>
  )
}
