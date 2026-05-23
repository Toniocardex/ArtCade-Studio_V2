// ---------------------------------------------------------------------------
// ResizeHandle — 4px vertical drag bar between two flex columns.
//   - mousedown captures the pointer, mousemove dispatches deltaX,
//     mouseup releases. Works at the column edge between sidebar/center.
//   - The `side` flag inverts the delta sign so the caller can always feed
//     "absolute width" into `setWidth(w + delta)` for the adjacent column.
// ---------------------------------------------------------------------------

import { useCallback, useRef } from 'react'

export default function ResizeHandle({
  onResize,
  side,
}: {
  /** Delta in CSS pixels: positive = column grows. */
  onResize: (deltaPx: number) => void
  /** Which sidebar this handle resizes (controls drag direction sign). */
  side: 'left' | 'right'
}) {
  const lastX = useRef<number | null>(null)

  const onMove = useCallback(
    (ev: MouseEvent) => {
      if (lastX.current == null) return
      const dx = ev.clientX - lastX.current
      lastX.current = ev.clientX
      // For the LEFT sidebar (handle on its right edge), positive mouseX delta
      // means the sidebar GROWS. For the RIGHT sidebar (handle on its left
      // edge), positive mouseX delta means the sidebar SHRINKS.
      onResize(side === 'left' ? dx : -dx)
    },
    [onResize, side],
  )

  const onUp = useCallback(() => {
    lastX.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }, [onMove])

  const onDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      lastX.current = e.clientX
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [onMove, onUp],
  )

  return (
    <div
      onMouseDown={onDown}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${side} sidebar`}
      title="Drag to resize"
      className="w-1 flex-shrink-0 cursor-col-resize bg-[var(--border)]
                 hover:bg-[var(--accent-2)] active:bg-[var(--accent-2)] transition-colors"
    />
  )
}
