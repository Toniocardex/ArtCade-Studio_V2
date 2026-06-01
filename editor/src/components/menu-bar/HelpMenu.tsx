import { useCallback, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ToolbarDropdown } from './ToolbarDropdown'

const DOCS_URL = 'https://github.com/Toniocardex/ArtCade-Studio_V2/blob/main/docs/README.md'

export function HelpMenu() {
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
            ? 'border-[var(--outline-strong)] bg-[var(--surface-selected)] text-[var(--text-on-selected)]'
            : 'border-[var(--outline)] bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--primary)]'
        }`}
      >
        HELP
        <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
      </button>
      <ToolbarDropdown open={open} anchorRef={anchorRef} align="right" onClose={close}>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          className="block px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]"
          onClick={close}
        >
          Documentation…
        </a>
        <button
          type="button"
          role="menuitem"
          className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]"
          onClick={() => {
            void navigator.clipboard?.writeText('ArtCade Studio — editor UI refactor 2026')
            close()
          }}
        >
          About ArtCade Studio
        </button>
      </ToolbarDropdown>
    </div>
  )
}
