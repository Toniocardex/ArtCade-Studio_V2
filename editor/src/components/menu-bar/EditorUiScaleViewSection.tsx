import { EDITOR_UI_SCALE_VALUES } from '../../constants/editor-ui-scale'
import { formatEditorUiScalePercent } from '../../utils/editor-ui-scale'
import type { EditorUiScaleApi } from '../../hooks/useEditorUiScale'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { clearEditorLayoutSnapshot } from '../../utils/editor-layout-persist'
import { useEditorLayoutContext } from '../../contexts/editor-layout-context'
import { useWorkspaceLayoutMetricsContext } from '../../contexts/editor-layout-tier-context'

type Props = Readonly<{ uiScale: EditorUiScaleApi }>

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

/** VIEW → Interface: UI scale picker, focus mode, layout reset, motion prefs. */
export function EditorUiScaleViewSection({ uiScale }: Props) {
  const dispatch = useEditorDispatch()
  const focusMode = useEditorSelector((s) => s.focusMode)
  const reduceMotion = useEditorSelector((s) => s.reduceMotion)
  const layout = useEditorLayoutContext()
  const { scale, setScale, resetScale } = uiScale
  const { width, height } = useWorkspaceLayoutMetricsContext()

  function resetLayoutForResolution() {
    clearEditorLayoutSnapshot(width, height)
    layout.resetToDefaults()
  }

  return (
    <div className="border-b border-[var(--outline-subtle)]">
      <div className="px-3 pt-2 pb-1">
        <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Interface</span>
      </div>

      {/* Compact segmented scale picker */}
      <div className="px-3 pb-2 flex items-center gap-1.5">
        <span className="text-[10px] text-[var(--muted)] shrink-0">Scale</span>
        <div className="flex gap-0.5 flex-wrap">
          {EDITOR_UI_SCALE_VALUES.map((value) => {
            const active = scale === value
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                title={value === 1 ? 'Default (Ctrl+Shift+0)' : `${formatEditorUiScalePercent(value)}`}
                className={`px-1.5 py-0.5 rounded text-[10px] leading-none transition-colors ${
                  active
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-fg-on-bg)] font-semibold'
                    : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
                }`}
                onClick={() => setScale(value)}
              >
                {formatEditorUiScalePercent(value)}
              </button>
            )
          })}
        </div>
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
        title="Ctrl+Shift+= increase  ·  Ctrl+Shift+- decrease  ·  Ctrl+Shift+0 reset"
        className="w-full text-left px-3 py-1.5 pb-2 text-xs text-[var(--primary-soft)] hover:bg-[var(--surface-hover)]"
        onClick={resetScale}
      >
        Reset scale to 100%
      </button>
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
