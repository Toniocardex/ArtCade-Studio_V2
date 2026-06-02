import { EDITOR_UI_SCALE_VALUES } from '../../constants/editor-ui-scale'
import { formatEditorUiScalePercent } from '../../utils/editor-ui-scale'
import type { EditorUiScaleApi } from '../../hooks/useEditorUiScale'
import { useEditor } from '../../store/editor-store'
import { clearEditorLayoutSnapshot } from '../../utils/editor-layout-persist'
import { useEditorLayoutContext } from '../../contexts/editor-layout-context'
import { useWorkspaceLayoutMetricsContext } from '../../contexts/editor-layout-tier-context'

type EditorUiScaleViewSectionProps = Readonly<{
  uiScale: EditorUiScaleApi
}>

/** VIEW → Interface — UI scale presets (docs/ADAPTIVE_LAYOUT.md Phase 1). */
export function EditorUiScaleViewSection({ uiScale }: EditorUiScaleViewSectionProps) {
  const { state, dispatch } = useEditor()
  const layout = useEditorLayoutContext()
  const { scale, setScale, resetScale } = uiScale

  const { width, height } = useWorkspaceLayoutMetricsContext()

  function resetLayoutForResolution() {
    clearEditorLayoutSnapshot(width, height)
    layout.resetToDefaults()
  }

  return (
    <div className="border-b border-[var(--outline-subtle)]">
      <div className="px-3 py-2">
        <span className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Interface</span>
      </div>
      <div className="px-1 pb-1">
        <div className="px-2 py-1 text-[9px] text-[var(--muted)]">UI scale</div>
        {EDITOR_UI_SCALE_VALUES.map((value) => {
          const active = scale === value
          return (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              title={
                value === 1
                  ? 'Default density (Ctrl+Shift+0)'
                  : `${formatEditorUiScalePercent(value)} density`
              }
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]
                         flex items-center justify-between gap-2"
              onClick={() => setScale(value)}
            >
              <span>{formatEditorUiScalePercent(value)}</span>
              {active ? (
                <span className="text-[var(--accent)]" aria-hidden>✓</span>
              ) : null}
            </button>
          )
        })}
        <button
          type="button"
          role="menuitem"
          className="w-full text-left px-3 py-1.5 text-xs text-[var(--primary-soft)] hover:bg-[var(--surface-hover)]"
          onClick={resetScale}
        >
          Reset UI scale to 100%
          <span className="block text-[9px] text-[var(--muted)] mt-0.5">
            Ctrl+Shift+= increase · Ctrl+Shift+- decrease
          </span>
        </button>
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={state.focusMode}
          className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]"
          onClick={() => dispatch({ type: 'TOGGLE_FOCUS_MODE' })}
        >
          Focus mode (F11)
        </button>
        <button
          type="button"
          role="menuitem"
          className="w-full text-left px-3 py-2 text-xs text-[var(--primary-soft)] hover:bg-[var(--surface-hover)]"
          onClick={resetLayoutForResolution}
        >
          Reset layout for current resolution
        </button>
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={state.reduceMotion}
          className="w-full text-left px-3 py-2 text-xs text-[var(--primary)] hover:bg-[var(--surface-hover)]"
          onClick={() => dispatch({ type: 'SET_REDUCE_MOTION', enabled: !state.reduceMotion })}
        >
          Reduce motion
        </button>
      </div>
    </div>
  )
}
