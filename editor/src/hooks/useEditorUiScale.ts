// ---------------------------------------------------------------------------
// useEditorUiScale - global editor chrome density (--editor-scale on shell)
// ---------------------------------------------------------------------------

import { useCallback, useState } from 'react'
import {
  EDITOR_UI_SCALE_DEFAULT,
  type EditorUiScale,
} from '../constants/editor-ui-scale'
import {
  formatEditorUiScalePercent,
  hasSeenEditorUiScaleSuggestion,
  markEditorUiScaleSuggestionSeen,
  readStoredEditorUiScale,
  suggestEditorUiScale,
  stepEditorUiScale,
  writeStoredEditorUiScale,
} from '../utils/editor-ui-scale'
import { useEditorUiScaleShortcuts } from './useEditorUiScaleShortcuts'

function readWorkspaceSize(): { width: number; height: number } {
  if (globalThis.window === undefined) {
    return { width: 1920, height: 1080 }
  }
  return { width: globalThis.innerWidth, height: globalThis.innerHeight }
}

export type EditorUiScaleApi = {
  scale: EditorUiScale
  scaleLabel: string
  suggestedScale: EditorUiScale | null
  setScale: (scale: EditorUiScale) => void
  acceptSuggestedScale: () => void
  ignoreSuggestedScale: () => void
  increaseScale: () => void
  decreaseScale: () => void
  resetScale: () => void
}

export function useEditorUiScale(): EditorUiScaleApi {
  const [suggestedScale, setSuggestedScale] = useState<EditorUiScale | null>(() => {
    if (readStoredEditorUiScale() || hasSeenEditorUiScaleSuggestion()) return null
    const { width, height } = readWorkspaceSize()
    const suggestion = suggestEditorUiScale(width, height)
    return suggestion === EDITOR_UI_SCALE_DEFAULT ? null : suggestion
  })

  const [scale, setScaleState] = useState<EditorUiScale>(() => {
    const stored = readStoredEditorUiScale()
    if (stored) return stored
    // When the suggestion banner is pending, do NOT pre-apply the suggestion:
    // open at the default so "Keep X%" visibly applies it. Pre-applying made the
    // UI already sit at the suggested scale, so the button looked like a no-op.
    if (suggestedScale != null) return EDITOR_UI_SCALE_DEFAULT
    const { width, height } = readWorkspaceSize()
    return suggestEditorUiScale(width, height)
  })

  const setScale = useCallback((next: EditorUiScale) => {
    setScaleState(next)
    writeStoredEditorUiScale(next)
    markEditorUiScaleSuggestionSeen()
    setSuggestedScale(null)
  }, [])

  const acceptSuggestedScale = useCallback(() => {
    const target = suggestedScale ?? scale
    setScaleState(target)
    writeStoredEditorUiScale(target)
    markEditorUiScaleSuggestionSeen()
    setSuggestedScale(null)
  }, [suggestedScale, scale])

  const ignoreSuggestedScale = useCallback(() => {
    setScaleState(EDITOR_UI_SCALE_DEFAULT)
    writeStoredEditorUiScale(EDITOR_UI_SCALE_DEFAULT)
    markEditorUiScaleSuggestionSeen()
    setSuggestedScale(null)
  }, [])

  const increaseScale = useCallback(() => {
    setScaleState((prev) => {
      const next = stepEditorUiScale(prev, 1)
      writeStoredEditorUiScale(next)
      markEditorUiScaleSuggestionSeen()
      setSuggestedScale(null)
      return next
    })
  }, [])

  const decreaseScale = useCallback(() => {
    setScaleState((prev) => {
      const next = stepEditorUiScale(prev, -1)
      writeStoredEditorUiScale(next)
      markEditorUiScaleSuggestionSeen()
      setSuggestedScale(null)
      return next
    })
  }, [])

  const resetScale = useCallback(() => {
    setScale(EDITOR_UI_SCALE_DEFAULT)
  }, [setScale])

  useEditorUiScaleShortcuts({ increaseScale, decreaseScale, resetScale })

  return {
    scale,
    scaleLabel: formatEditorUiScalePercent(scale),
    suggestedScale,
    setScale,
    acceptSuggestedScale,
    ignoreSuggestedScale,
    increaseScale,
    decreaseScale,
    resetScale,
  }
}
