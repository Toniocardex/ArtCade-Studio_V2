import { LayoutGrid, Workflow, Code2, Sun, Moon, Cpu } from 'lucide-react'
import { useState } from 'react'
import { useEditor } from '../store/editor-store'
import { applyTheme, toggleTheme, type Theme } from '../utils/theme'
import type { EditorView } from '../types'

const MODES: { id: EditorView; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'canvas', label: 'Canvas',       icon: LayoutGrid },
  { id: 'logic',  label: 'Logic Board',  icon: Workflow   },
  { id: 'script', label: 'Editor Script', icon: Code2     },
]

export default function ModuleRail() {
  const { state, dispatch } = useEditor()
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute('data-theme') as Theme) || 'dark',
  )

  return (
    <nav className="w-14 flex-shrink-0 flex flex-col items-center
                    border-r border-[var(--border)] bg-[var(--panel)] py-3 select-none">
      <div className="text-[var(--accent)] mb-4" title="Artcade v2.0">
        <Cpu size={22} />
      </div>

      <div className="flex flex-col gap-1.5">
        {MODES.map(({ id, label, icon: Icon }) => {
          const active = state.mode === id
          return (
            <button
              key={id}
              onClick={() => dispatch({ type: 'SET_MODE', mode: id })}
              title={label}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                active
                  ? 'bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-bd)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-3)]'
              }`}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      <button
        onClick={() => {
          const next = toggleTheme(theme)
          applyTheme(next)
          setTheme(next)
        }}
        title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
        className="w-10 h-10 flex items-center justify-center rounded-lg
                   text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--panel-3)] transition-all"
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </nav>
  )
}
