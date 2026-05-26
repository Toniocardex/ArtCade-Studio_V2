import { useEditor } from '../store/editor-store'
import type { AuthoringMode } from '../types/authoring-mode'

const btn = (active: boolean) =>
  [
    'flex-1 py-1.5 text-[9px] font-semibold tracking-wide transition-colors',
    active
      ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
      : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-3)]',
  ].join(' ')

/** Base vs Advanced — presentation tier (default Base). All tools stay available. */
export default function AuthoringModeSwitch() {
  const { state, dispatch } = useEditor()
  const mode = state.authoringMode

  const set = (next: AuthoringMode) => {
    if (next !== mode) dispatch({ type: 'SET_AUTHORING_MODE', mode: next })
  }

  return (
    <div className="flex flex-col gap-1 w-full" title="Guidance and layout density — same tools in both modes">
      <span className="text-[8px] font-medium uppercase tracking-wider text-[var(--muted)] px-0.5">
        View
      </span>
      <div
        className="flex rounded-md border border-[var(--border)] overflow-hidden bg-[var(--bg)]"
        role="group"
        aria-label="Authoring view"
      >
        <button
          type="button"
          className={btn(mode === 'base')}
          aria-pressed={mode === 'base'}
          onClick={() => set('base')}
        >
          Base
        </button>
        <button
          type="button"
          className={btn(mode === 'advanced')}
          aria-pressed={mode === 'advanced'}
          onClick={() => set('advanced')}
        >
          Advanced
        </button>
      </div>
    </div>
  )
}
