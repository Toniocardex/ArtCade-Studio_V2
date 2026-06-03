// ---------------------------------------------------------------------------
// VerticalResizeHandle - 6px horizontal drag bar above the bottom dock.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from 'react'

export type VerticalResizeHandleProps = Readonly<{
  /** Positive delta = panel grows upward. */
  onResize: (deltaPx: number) => void
  /** Double-click restores default height for this panel. */
  onReset?: () => void
}>

export default function VerticalResizeHandle({ onResize, onReset }: VerticalResizeHandleProps) {
  const lastY = useRef<number | null>(null)
  const onResizeR = useRef(onResize)
  onResizeR.current = onResize

  const moveRef = useRef<((ev: MouseEvent) => void) | null>(null)
  const upRef = useRef<(() => void) | null>(null)

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
      onDoubleClick={(e) => {
        e.preventDefault()
        onReset?.()
      }}
      aria-label="Resize bottom dock"
      title="Drag to resize. Double-click for default height."
      className="editor-resize-handle editor-resize-handle-y h-[6px] w-full flex-shrink-0 cursor-row-resize border-0 p-0 min-w-0
                 bg-[var(--border)] hover:bg-[var(--accent-2)] active:bg-[var(--accent-2)]
                 transition-colors"
    >
      <span aria-hidden className="editor-resize-handle__ticks" />
    </button>
  )
}
