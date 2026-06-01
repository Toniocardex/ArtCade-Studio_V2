import { useCallback, useRef, useState } from 'react'
import { ChevronDown, Moon, Sun } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import { applyTheme, toggleTheme, type Theme } from '../../utils/theme'
import AuthoringModeSwitch from '../AuthoringModeSwitch'
import { openDialogLibraryModal } from '../../panels/dialog/dialog-modal-api'
import { ToolbarDropdown } from './ToolbarDropdown'
import { DockPanelsViewSection } from './DockPanelsViewSection'

function themeFromDocument(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : 'dark'
}

export function ViewToolbarMenu() {
  const { dispatch } = useEditor()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(themeFromDocument)
  const anchorRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])

  return (
    <div ref={anchorRef} className="relative editor-toolbar-workspace-end pr-[var(--editor-workspace-inset)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="editor-toolbar-btn border border-[var(--outline)] bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--outline)]"
      >
        VIEW
        <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
      </button>
      <ToolbarDropdown open={open} anchorRef={anchorRef} align="right" onClose={close}>
        <div className="px-3 py-2 border-b border-[var(--outline-subtle)]">
          <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Authoring</span>
          <div className="mt-2">
            <AuthoringModeSwitch />
          </div>
        </div>
        <DockPanelsViewSection />
        <button
          type="button"
          role="menuitem"
          className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]"
          onClick={() => {
            const next = toggleTheme(theme)
            applyTheme(next)
            setTheme(next)
          }}
        >
          <span className="inline-flex items-center gap-2">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark'
              ? 'Switch to light theme (mid-grey)'
              : 'Switch to dark theme (anthracite)'}
          </span>
        </button>
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
