import React, { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  left: React.ReactNode
  right: React.ReactNode
  initialRatio?: number // 0–100, default 50
  minRatio?: number
  maxRatio?: number
}

export default function SplitPane({
  left,
  right,
  initialRatio = 50,
  minRatio = 15,
  maxRatio = 85,
}: Props) {
  const [ratio, setRatio] = useState(initialRatio)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100
      setRatio(Math.min(maxRatio, Math.max(minRatio, newRatio)))
    },
    [dragging, minRatio, maxRatio]
  )

  const onMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, onMouseMove, onMouseUp])

  return (
    <div ref={containerRef} className="flex w-full h-full overflow-hidden" style={{minHeight: 0}}>
      {/* Left pane */}
      <div
        style={{ width: `${ratio}%` }}
        className="h-full overflow-hidden flex flex-col min-w-0"
      >
        {left}
      </div>

      {/* Divider */}
      <div
        onMouseDown={onMouseDown}
        className={`split-divider w-1 h-full bg-gray-200 dark:bg-gray-700 shrink-0 transition-colors ${dragging ? 'dragging' : ''}`}
      />

      {/* Right pane */}
      <div
        style={{ width: `${100 - ratio}%` }}
        className="h-full overflow-hidden flex flex-col min-w-0"
      >
        {right}
      </div>
    </div>
  )
}
