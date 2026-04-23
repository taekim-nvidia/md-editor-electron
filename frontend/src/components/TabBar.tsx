import React from 'react'
import { Tab } from '../types'

interface Props {
  tabs: Tab[]
  activeTabId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export default function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }: Props) {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-x-auto shrink-0">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`
            flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer whitespace-nowrap border-r border-gray-200 dark:border-gray-700 select-none
            ${
              tab.id === activeTabId
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-b-2 border-b-indigo-500'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
        >
          <span className="max-w-[140px] truncate">{tab.filename}</span>
          {tab.content !== tab.originalContent && (
            <span className="text-indigo-500 text-xs" title="Unsaved changes">●</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose(tab.id)
            }}
            className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            title="Close tab"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={onNew}
        className="px-3 py-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 text-lg leading-none"
        title="New tab"
      >
        +
      </button>
    </div>
  )
}
