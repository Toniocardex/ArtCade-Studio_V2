// ---------------------------------------------------------------------------
// ConsoleOverlay — slide-up console panel toggled by Ctrl+`.
// Wraps the existing ConsolePanel content; provides only the chrome + close.
// ---------------------------------------------------------------------------

import { X } from 'lucide-react'
import ConsolePanel from '../panels/ConsolePanel'

export default function ConsoleOverlay({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="absolute left-0 right-0 bottom-0 z-40 h-[40vh] flex flex-col
                 bg-[var(--panel)] border-t border-[var(--accent-2)] shadow-none"
      role="dialog"
      aria-label="Console overlay"
    >
      <div className="px-3 h-7 flex items-center justify-between border-b border-[var(--border)] flex-shrink-0">
        <span className="text-[10px] tracking-wider uppercase text-[var(--muted)] font-semibold">
          Console
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Close console (Ctrl+`)"
          aria-label="Close console"
          className="text-[var(--muted)] hover:text-[var(--text)] leading-none"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ConsolePanel />
      </div>
    </div>
  )
}
