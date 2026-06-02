// ---------------------------------------------------------------------------
// useEditorUiScale — global editor chrome density (--editor-scale on shell)
// ---------------------------------------------------------------------------

import { useCallback, useState } from 'react'
import {
  EDITOR_UI_SCALE_DEFAULT,
  type EditorUiScale,
} from '../constants/editor-ui-scale'
import {
  formatEditorUiScalePercent,
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
  setScale: (scale: EditorUiScale) => void
  increaseScale: () => void
  decreaseScale: () => void
  resetScale: () => void
}

export function useEditorUiScale(): EditorUiScaleApi {
  const [scale, setScaleState] = useState<EditorUiScale>(() => {
    const stored = readStoredEditorUiScale()
    if (stored) return stored
    const { width, height } = readWorkspaceSize()
    const initial = suggestEditorUiScale(width, height)
    writeStoredEditorUiScale(initial)
    return initial
  })

  const setScale = useCallback((next: EditorUiScale) => {
    setScaleState(next)
    writeStoredEditorUiScale(next)
  }, [])

  const increaseScale = useCallback(() => {
    setScaleState((prev) => {
      const next = stepEditorUiScale(prev, 1)
      writeStoredEditorUiScale(next)
      return next
    })
  }, [])

  const decreaseScale = useCallback(() => {
    setScaleState((prev) => {
      const next = stepEditorUiScale(prev, -1)
      writeStoredEditorUiScale(next)
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
    setScale,
    increaseScale,
    decreaseScale,
    resetScale,
  }
}
