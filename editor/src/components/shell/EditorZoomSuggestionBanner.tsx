import { useState } from 'react'
import { useEditorDispatch } from '../../store/editor-store'
import { formatZoomPercent } from '../../utils/editor-zoom'

const SEEN_KEY = 'artcade.zoom-suggestion-seen-v1'

/** First-run canvas-zoom suggestion from workspace size. Local preference only. */
function suggestZoomForWindow(width: number, height: number): number {
  if (width >= 2560 && height >= 1440) return 1.15
  if (width >= 1920 && height >= 1080) return 1
  if (width >= 1600 && height >= 900) return 0.9
  if (width >= 1366 && height >= 768) return 0.85
  return 0.75
}

/**
 * Boot hint that sets the canvas zoom (the single source of truth — the same
 * value shown in the toolbar and status bar). Accept applies the suggestion via
 * EDITOR_SET_ZOOM; "Use 100%" pins it to 100%.
 */
export function EditorZoomSuggestionBanner() {
  const dispatch = useEditorDispatch()

  const [suggestion] = useState<number | null>(() => {
    if (globalThis.localStorage === undefined) return null
    if (globalThis.localStorage.getItem(SEEN_KEY) === '1') return null
    const s = suggestZoomForWindow(globalThis.innerWidth, globalThis.innerHeight)
    return s === 1 ? null : s
  })
  const [dismissed, setDismissed] = useState(false)

  if (suggestion == null || dismissed) return null

  const apply = (zoom: number) => {
    dispatch({ type: 'EDITOR_SET_ZOOM', zoom })
    globalThis.localStorage?.setItem(SEEN_KEY, '1')
    setDismissed(true)
  }

  const label = formatZoomPercent(suggestion)

  return (
    <div
      className="shrink-0 flex items-center justify-between gap-3 px-3 py-1.5
                 border-b border-[var(--outline)] bg-[var(--surface-2)]
                 text-[10px] text-[var(--primary-soft)]"
      role="status"
    >
      <span>
        Suggested canvas zoom for this window: <strong className="text-[var(--primary)]">{label}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className="editor-mini-btn" onClick={() => apply(suggestion)}>
          Keep {label}
        </button>
        <button type="button" className="editor-mini-btn" onClick={() => apply(1)}>
          Use 100%
        </button>
      </div>
    </div>
  )
}
