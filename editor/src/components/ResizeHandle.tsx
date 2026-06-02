// ---------------------------------------------------------------------------
// ResizeHandle — 4px vertical drag bar between two flex columns.
//   - mousedown captures the pointer, mousemove dispatches deltaX,
//     mouseup OR globalThis blur releases. Works at the column edge between
//     sidebar/center.
//   - The `side` flag inverts the delta sign so the caller can always feed
//     "absolute width" into `setWidth(w + delta)` for the adjacent column.
//   - Listeners are tracked via refs and unconditionally cleaned up on
//     unmount, so a mid-drag unmount cannot leak window listeners or leave
//     the cursor stuck on `col-resize`.
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
  const lastX     = useRef<number | null>(null)
  const onResizeR = useRef(onResize)
  const sideR     = useRef(side)
  onResizeR.current = onResize
  sideR.current     = side

  // Stable handlers — defined once, read latest props from refs so we can
  // attach/remove the same identity to globalThis listeners without churn.
  const moveRef = useRef<((ev: MouseEvent) => void) | null>(null)
  const upRef   = useRef<(() => void) | null>(null)

  moveRef.current ??= (ev: MouseEvent) => {
    if (lastX.current == null) return
    const dx = ev.clientX - lastX.current
    lastX.current = ev.clientX
    // LEFT handle (on the left sidebar's right edge): positive mouseX
    // delta → sidebar grows. RIGHT handle (on right sidebar's left edge):
    // positive mouseX delta → sidebar shrinks.
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

  // Defense in depth: if the component unmounts mid-drag, dispose listeners
  // and reset cursor / userSelect so the editor stays usable.
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
      title="Drag to resize · double-click for default width"
      className="w-1 flex-shrink-0 cursor-col-resize border-0 p-0 min-h-0 self-stretch
                 bg-[var(--border)] hover:bg-[var(--accent-2)] active:bg-[var(--accent-2)]
                 transition-colors"
    />
  )
}

