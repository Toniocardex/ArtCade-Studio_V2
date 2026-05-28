import { LayoutGrid, Workflow, Code2, MessageSquare, Sun, Moon } from 'lucide-react'
import { useState } from 'react'
import { useEditor } from '../store/editor-store'
import { applyTheme, toggleTheme, type Theme } from '../utils/theme'
import type { EditorView } from '../types'
import AuthoringModeSwitch from './AuthoringModeSwitch'

const MODES: {
  id: EditorView
  label: string
  shortLabel: string
  icon: typeof LayoutGrid
}[] = [
  { id: 'canvas', label: 'Canvas',        shortLabel: 'Canvas', icon: LayoutGrid },
  { id: 'logic',  label: 'Logic Board',   shortLabel: 'Logic',  icon: Workflow },
  { id: 'script', label: 'Editor Script', shortLabel: 'Script', icon: Code2 },
  { id: 'dialog', label: 'Dialog Editor', shortLabel: 'Dialog', icon: MessageSquare },
]

function themeFromDocument(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : 'dark'
}

function modeBtnClass(active: boolean) {
  return [
    'relative flex flex-col items-center justify-center gap-1.5',
    'w-full py-2.5 px-1 rounded transition-colors',
    active
      ? 'bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-bd)]'
      : 'border border-transparent text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-3)]',
  ].join(' ')
}

/** Vertical module rail — sits beside the Scenes panel / workspace (not in the top menubar). */
export default function ModuleRail() {
  const { state, dispatch } = useEditor()
  const [theme, setTheme] = useState<Theme>(themeFromDocument)

  return (
    <nav
      className="editor-module-rail w-[var(--editor-rail-width)] flex-shrink-0 flex flex-col items-stretch
                 border-r border-[var(--border)] bg-[var(--panel)]
                 pt-3 pb-4 px-2 select-none"
      aria-label="Editor modules"
    >
      <div
        className="flex flex-col gap-4 p-2 rounded-xl
                   bg-[rgb(var(--bg-rgb)/0.35)] border border-[var(--border)]"
      >
        {MODES.map(({ id, label, shortLabel, icon: Icon }) => {
          const active = state.mode === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => dispatch({ type: 'SET_MODE', mode: id })}
              title={label}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={modeBtnClass(active)}
            >
              {active && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[var(--accent)]"
                  aria-hidden
                />
              )}
              <Icon size={18} className="flex-shrink-0" strokeWidth={active ? 2.25 : 2} />
              <span className="text-[9px] font-semibold leading-none tracking-wide">
                {shortLabel}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-h-4" />

      <AuthoringModeSwitch />

      <div className="h-2" />

      <button
        type="button"
        onClick={() => {
          const next = toggleTheme(theme)
          applyTheme(next)
          setTheme(next)
        }}
        title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
        aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        className={modeBtnClass(false)}
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        <span className="text-[9px] font-semibold leading-none tracking-wide">Theme</span>
      </button>
    </nav>
  )
}
