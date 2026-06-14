import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { clearEditorLayoutSnapshot } from '../../utils/editor-layout-persist'
import { useEditorLayoutContext } from '../../contexts/editor-layout-context'
import { useWorkspaceLayoutMetricsContext } from '../../contexts/editor-layout-tier-context'

function CheckRow({
  checked,
  label,
  title,
  onClick,
}: Readonly<{ checked: boolean; label: string; title?: string; onClick: () => void }>) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      title={title}
      className="w-full text-left px-3 py-1.5 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)] flex items-center gap-2"
      onClick={onClick}
    >
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none ${
          checked
            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-app)]'
            : 'border-[var(--outline)] bg-transparent'
        }`}
        aria-hidden
      >
        {checked ? '✓' : ''}
      </span>
      {label}
    </button>
  )
}

/** VIEW → focus mode, motion prefs, layout reset. */
export function EditorViewOptionsSection() {
  const dispatch = useEditorDispatch()
  const focusMode = useEditorSelector((s) => s.focusMode)
  const reduceMotion = useEditorSelector((s) => s.reduceMotion)
  const layout = useEditorLayoutContext()
  const { width, height } = useWorkspaceLayoutMetricsContext()

  function resetLayoutForResolution() {
    clearEditorLayoutSnapshot(width, height)
    layout.resetToDefaults()
  }

  return (
    <div className="border-b border-[var(--outline-subtle)]">
      <div className="px-3 pt-2 pb-1">
        <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">View</span>
      </div>

      <CheckRow
        checked={focusMode}
        label="Focus mode"
        title="Maximize canvas — hide all panels (F11)"
        onClick={() => dispatch({ type: 'TOGGLE_FOCUS_MODE' })}
      />
      <CheckRow
        checked={reduceMotion}
        label="Reduce motion"
        onClick={() => dispatch({ type: 'SET_REDUCE_MOTION', enabled: !reduceMotion })}
      />
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-1.5 pb-2 text-xs text-[var(--primary-soft)] hover:bg-[var(--surface-hover)]"
        onClick={resetLayoutForResolution}
      >
        Reset layout for this window
      </button>
    </div>
  )
}
