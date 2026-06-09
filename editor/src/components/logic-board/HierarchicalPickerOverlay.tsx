import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type HierarchicalPickerOverlayProps = Readonly<{
  open: boolean
  onClose: () => void
  children: ReactNode
}>

/**
 * Full-screen picker shell portaled to document.body.
 * Avoids overflow/z-index traps from nested editor panels (see ToolbarDropdown).
 */
export function HierarchicalPickerOverlay({
  open,
  onClose,
  children,
}: HierarchicalPickerOverlayProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-end bg-black/45"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex h-full w-[min(420px,92vw)] max-h-[100dvh] shrink-0 shadow-2xl pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
