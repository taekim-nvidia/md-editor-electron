import React, { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  left: React.ReactNode
  right: React.ReactNode
  direction?: 'horizontal' | 'vertical'
  initialRatio?: number
  minRatio?: number
  maxRatio?: number
}

export default function SplitPane({
  left,
  right,
  direction = 'horizontal',
  initialRatio = 50,
  minRatio = 15,
  maxRatio = 85,
}: Props) {
  const [ratio, setRatio] = useState(initialRatio)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isH = direction === 'horizontal'

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newRatio = isH
        ? ((e.clientX - rect.left) / rect.width) * 100
        : ((e.clientY - rect.top) / rect.height) * 100
      setRatio(Math.min(maxRatio, Math.max(minRatio, newRatio)))
    },
    [dragging, isH, minRatio, maxRatio]
  )

  const onMouseUp = useCallback(() => setDragging(false), [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = isH ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, isH, onMouseMove, onMouseUp])

  return (
    <div
      ref={containerRef}
      className={`flex w-full h-full overflow-hidden ${isH ? 'flex-row' : 'flex-col'}`}
      style={{ minHeight: 0 }}
    >
      {/* First pane */}
      <div
        style={isH ? { width: `${ratio}%` } : { height: `${ratio}%` }}
        className="overflow-hidden flex flex-col min-w-0 min-h-0"
      >
        {left}
      </div>

      {/* Divider */}
      <div
        onMouseDown={onMouseDown}
        className={`shrink-0 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors ${
          dragging ? 'bg-blue-500' : ''
        } ${isH ? 'w-1 h-full cursor-col-resize' : 'h-1 w-full cursor-row-resize'}`}
      />

      {/* Second pane */}
      <div
        style={isH ? { width: `${100 - ratio}%` } : { height: `${100 - ratio}%` }}
        className="overflow-hidden flex flex-col min-w-0 min-h-0"
      >
        {right}
      </div>
    </div>
  )
}
