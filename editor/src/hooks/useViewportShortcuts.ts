// ---------------------------------------------------------------------------
// useViewportShortcuts — Ctrl+0/9/+/-/8 for editor zoom + camera preview
// ---------------------------------------------------------------------------
//
// Extracted from App.tsx (TECHNICAL_DEBT_REVIEW §16). Only fires while in
// canvas mode (script mode owns its own CodeMirror Ctrl+= bindings).

import { useEffect } from 'react'
import { useEditor } from '../store/editor-store'
import { zoomFitRegistry } from '../utils/zoom-fit-registry'
import {
  EDITOR_ZOOM_DEFAULT, EDITOR_ZOOM_KEYBOARD_STEP,
  EDITOR_ZOOM_MIN, EDITOR_ZOOM_MAX,
} from '../constants/editor-viewport'

export function useViewportShortcuts(): void {
  const { state, dispatch } = useEditor()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey) return
      if (state.mode !== 'canvas') return

      const z = state.editorZoom

      if (e.key === '0') {
        e.preventDefault()
        dispatch({ type: 'EDITOR_SET_ZOOM', zoom: EDITOR_ZOOM_DEFAULT })
        return
      }
      // Ctrl+9 — fit to panel. PreviewPanel owns scrollRef and exposes the
      // computation via zoomFitRegistry (a typed bridge — no DOM events).
      if (e.key === '9') {
        e.preventDefault()
        zoomFitRegistry.invoke()
        return
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        dispatch({ type: 'EDITOR_SET_ZOOM', zoom: Math.min(EDITOR_ZOOM_MAX, z * EDITOR_ZOOM_KEYBOARD_STEP) })
        return
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        dispatch({ type: 'EDITOR_SET_ZOOM', zoom: Math.max(EDITOR_ZOOM_MIN, z / EDITOR_ZOOM_KEYBOARD_STEP) })
        return
      }
      // Ctrl+8 — toggle camera preview (clip canvas to scene viewportSize)
      if (e.key === '8') {
        e.preventDefault()
        dispatch({ type: 'EDITOR_SET_CAMERA_PREVIEW', enabled: !state.cameraPreview })
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.mode, state.editorZoom, state.cameraPreview, dispatch])
}
