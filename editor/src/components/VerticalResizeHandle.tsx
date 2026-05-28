// ---------------------------------------------------------------------------
// VerticalResizeHandle — 4px horizontal drag bar above a bottom dock panel.
// Positive delta = panel grows upward.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from 'react'

export type VerticalResizeHandleProps = Readonly<{
  onResize: (deltaPx: number) => void
}>

export default function VerticalResizeHandle({ onResize }: VerticalResizeHandleProps) {
  const lastY     = useRef<number | null>(null)
  const onResizeR = useRef(onResize)
  onResizeR.current = onResize

  const moveRef = useRef<((ev: MouseEvent) => void) | null>(null)
  const upRef   = useRef<(() => void) | null>(null)

  moveRef.current ??= (ev: MouseEvent) => {
    if (lastY.current == null) return
    const dy = lastY.current - ev.clientY
    lastY.current = ev.clientY
    onResizeR.current(dy)
  }

  upRef.current ??= () => {
    lastY.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    const move = moveRef.current
    const up = upRef.current
    if (move) globalThis.removeEventListener('mousemove', move)
    if (up) {
      globalThis.removeEventListener('mouseup', up)
      globalThis.removeEventListener('blur', up)
    }
  }

  const onDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    lastY.current = e.clientY
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    if (moveRef.current) globalThis.addEventListener('mousemove', moveRef.current)
    if (upRef.current) {
      globalThis.addEventListener('mouseup', upRef.current)
      globalThis.addEventListener('blur', upRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (upRef.current) upRef.current()
    }
  }, [])

  return (
    <button
      type="button"
      onMouseDown={onDown}
      aria-label="Resize bottom panel"
      title="Drag to resize"
      className="h-1 w-full flex-shrink-0 cursor-row-resize border-0 p-0 min-w-0
                 bg-[var(--border)] hover:bg-[var(--accent-2)] active:bg-[var(--accent-2)]
                 transition-colors"
    />
  )
}
