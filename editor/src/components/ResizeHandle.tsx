// ---------------------------------------------------------------------------
// ResizeHandle - 6px vertical drag bar between flex columns.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from 'react'

export type ResizeHandleProps = Readonly<{
  /** Delta in CSS pixels: positive = column grows. */
  onResize: (deltaPx: number) => void
  /** Which sidebar this handle resizes (controls drag direction sign). */
  side: 'left' | 'right'
  /** Double-click restores default width for this panel. */
  onReset?: () => void
}>

export default function ResizeHandle({ onResize, side, onReset }: ResizeHandleProps) {
  const lastX = useRef<number | null>(null)
  const onResizeR = useRef(onResize)
  const sideR = useRef(side)
  onResizeR.current = onResize
  sideR.current = side

  const moveRef = useRef<((ev: MouseEvent) => void) | null>(null)
  const upRef = useRef<(() => void) | null>(null)

  moveRef.current ??= (ev: MouseEvent) => {
    if (lastX.current == null) return
    const dx = ev.clientX - lastX.current
    lastX.current = ev.clientX
    onResizeR.current(sideR.current === 'left' ? dx : -dx)
  }

  upRef.current ??= () => {
    lastX.current = null
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
    lastX.current = e.clientX
    document.body.style.cursor = 'col-resize'
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
      aria-label={`Resize ${side} sidebar`}
      title="Drag to resize. Snaps near 180, 240, 300, 360px. Double-click for default width."
      className="editor-resize-handle editor-resize-handle-x w-[6px] flex-shrink-0 cursor-col-resize border-0 p-0 min-h-0 self-stretch
                 bg-[var(--border)] hover:bg-[var(--accent-2)] active:bg-[var(--accent-2)]
                 transition-colors"
    >
      <span aria-hidden className="editor-resize-handle__ticks" />
    </button>
  )
}
