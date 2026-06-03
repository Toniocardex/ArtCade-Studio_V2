import { formatEditorUiScalePercent } from '../../utils/editor-ui-scale'
import { useEditorUiScaleContext } from '../../contexts/editor-ui-scale-context'

/** First-run UI scale hint; local user preference, never project state. */
export function EditorUiScaleSuggestionBanner() {
  const uiScale = useEditorUiScaleContext()
  if (!uiScale.suggestedScale) return null

  const label = formatEditorUiScalePercent(uiScale.suggestedScale)

  return (
    <div
      className="shrink-0 flex items-center justify-between gap-3 px-3 py-1.5
                 border-b border-[var(--outline)] bg-[var(--surface-2)]
                 text-[10px] text-[var(--primary-soft)]"
      role="status"
    >
      <span>
        Suggested interface scale for this window: <strong className="text-[var(--primary)]">{label}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="editor-mini-btn"
          onClick={uiScale.acceptSuggestedScale}
        >
          Keep {label}
        </button>
        <button
          type="button"
          className="editor-mini-btn"
          onClick={uiScale.ignoreSuggestedScale}
        >
          Use 100%
        </button>
      </div>
    </div>
  )
}
