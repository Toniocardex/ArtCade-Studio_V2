// ---------------------------------------------------------------------------
// VerticalResizeHandle — 4px horizontal drag bar above a bottom dock panel.
// Positive delta = panel grows upward.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from 'react'

export default function VerticalResizeHandle({
  onResize,
}: {
  onResize: (deltaPx: number) => void
}) {
  const lastY     = useRef<number | null>(null)
  const onResizeR = useRef(onResize)
  onResizeR.current = onResize

  const moveRef = useRef<((ev: MouseEvent) => void) | null>(null)
  const upRef   = useRef<(() => void) | null>(null)

  if (moveRef.current === null) {
    moveRef.current = (ev: MouseEvent) => {
      if (lastY.current == null) return
      const dy = lastY.current - ev.clientY
      lastY.current = ev.clientY
      onResizeR.current(dy)
    }
  }
  if (upRef.current === null) {
    upRef.current = () => {
      lastY.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (moveRef.current) window.removeEventListener('mousemove', moveRef.current)
      if (upRef.current)   window.removeEventListener('mouseup',   upRef.current)
      window.removeEventListener('blur', upRef.current!)
    }
  }

  const onDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    lastY.current = e.clientY
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    if (moveRef.current) window.addEventListener('mousemove', moveRef.current)
    if (upRef.current) {
      window.addEventListener('mouseup', upRef.current)
      window.addEventListener('blur',    upRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (upRef.current) upRef.current()
    }
  }, [])

  return (
    <div
      onMouseDown={onDown}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize bottom panel"
      title="Drag to resize"
      className="h-1 flex-shrink-0 cursor-row-resize bg-[var(--border)]
                 hover:bg-[var(--accent-2)] active:bg-[var(--accent-2)] transition-colors"
    />
  )
}
