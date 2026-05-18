import { useEditor } from '../store/editor-store'
import type { EditorView } from '../types'

const TABS: { id: EditorView; label: string }[] = [
  { id: 'canvas', label: 'Canvas'        },
  { id: 'logic',  label: 'Logic Board'   },
  { id: 'script', label: 'Editor Script' },
]

export default function TopTabBar() {
  const { state, dispatch } = useEditor()

  return (
    <div className="flex items-center gap-1 bg-[var(--panel-3)] rounded-lg p-1">
      {TABS.map(({ id, label }) => {
        const active = state.mode === id
        return (
          <button
            key={id}
            onClick={() => dispatch({ type: 'SET_MODE', mode: id })}
            className={`px-4 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
              active
                ? 'bg-[var(--accent)] text-[var(--bg)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
