import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import { openDialogLibraryModal } from '../../panels/dialog/dialog-modal-api'

export function ToolsMenu() {
  const { dispatch } = useEditor()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, close])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`editor-toolbar-btn border ${
          open
            ? 'border-[var(--outline)] bg-[var(--outline-faint)] text-[var(--primary)]'
            : 'border-[var(--outline)] bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--primary)]'
        }`}
      >
        TOOLS
        <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-[60] min-w-[200px] py-2 border border-[var(--outline)]
                     bg-[var(--surface)] rounded-[var(--radius-md)]"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--outline-faint)]"
            onClick={() => {
              openDialogLibraryModal(dispatch)
              close()
            }}
          >
            Dialog library…
          </button>
        </div>
      )}
    </div>
  )
}
