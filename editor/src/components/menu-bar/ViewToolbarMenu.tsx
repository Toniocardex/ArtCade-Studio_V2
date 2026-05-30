import { useState } from 'react'
import { ChevronDown, Moon, Sun } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import { applyTheme, toggleTheme, type Theme } from '../../utils/theme'
import AuthoringModeSwitch from '../AuthoringModeSwitch'
import { openDialogLibraryModal } from '../../panels/dialog/dialog-modal-api'

function themeFromDocument(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : 'dark'
}

export function ViewToolbarMenu() {
  const { dispatch } = useEditor()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(themeFromDocument)

  return (
    <div className="relative editor-toolbar-workspace-end pr-[var(--editor-workspace-inset)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="editor-toolbar-btn border border-[var(--outline)] bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--outline)]"
      >
        VIEW
        <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-[60] min-w-[200px] py-2 border border-[var(--outline)]
                     bg-[var(--surface)] rounded-[var(--radius-md)] shadow-none"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-[var(--outline-subtle)]">
            <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Authoring</span>
            <div className="mt-2">
              <AuthoringModeSwitch />
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--outline)]"
            onClick={() => {
              const next = toggleTheme(theme)
              applyTheme(next)
              setTheme(next)
            }}
          >
            <span className="inline-flex items-center gap-2">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark' ? 'Light theme' : 'Dark theme'}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--outline)]"
            onClick={() => {
              openDialogLibraryModal(dispatch)
              setOpen(false)
            }}
          >
            Dialog library…
          </button>
        </div>
      )}
    </div>
  )
}
