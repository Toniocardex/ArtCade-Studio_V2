import { useEditor } from '../store/editor-store'
import type { AuthoringMode } from '../types/authoring-mode'

const btn = (active: boolean) =>
  [
    'w-full py-1.5 text-[9px] font-semibold leading-none transition-colors',
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
      <span className="text-[8px] font-medium uppercase tracking-wider text-[var(--muted)] text-center">
        View
      </span>
      <div
        className="flex flex-col rounded-md border border-[var(--border)] overflow-hidden bg-[var(--bg)]"
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
        <div className="h-px bg-[var(--border)]" aria-hidden />
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
