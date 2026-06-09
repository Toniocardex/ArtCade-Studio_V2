import { useCallback, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useEditorDispatch } from '../../store/editor-store'
import { openDialogLibraryModal } from '../../panels/dialog/dialog-modal-api'
import { ToolbarDropdown } from './ToolbarDropdown'

export function ToolsMenu() {
  const dispatch = useEditorDispatch()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  return (
    <div ref={anchorRef} className="relative">
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
      <ToolbarDropdown open={open} anchorRef={anchorRef} onClose={close}>
        <button
          type="button"
          role="menuitem"
          className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]"
          onClick={() => {
            openDialogLibraryModal(dispatch)
            close()
          }}
        >
          Dialog library…
        </button>
      </ToolbarDropdown>
    </div>
  )
}
