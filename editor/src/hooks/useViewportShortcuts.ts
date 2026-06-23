// ---------------------------------------------------------------------------
// useViewportShortcuts — Ctrl+0/9/+/-/8 for editor zoom + camera preview
// ---------------------------------------------------------------------------
//
// Extracted from App.tsx (TECHNICAL_DEBT_REVIEW §16). Only fires while in
// canvas mode (script mode owns its own CodeMirror Ctrl+= bindings).

import { useEffect } from 'react'
import {
  useEditorDispatch,
  useEditorStore,
  type Action,
  type CoreState,
} from '../store/editor-store'
import { zoomFitRegistry } from '../utils/zoom-fit-registry'
import { frameSelectionRegistry } from '../utils/frame-selection-registry'
import { shouldIgnoreEditorShortcut } from '../utils/keyboard'
import {
  EDITOR_ZOOM_DEFAULT, EDITOR_ZOOM_KEYBOARD_STEP,
  EDITOR_ZOOM_MIN, EDITOR_ZOOM_MAX,
} from '../constants/editor-viewport'

type CanvasDuplicateShortcutState = Pick<
  CoreState,
  'mode' | 'isPlaying' | 'selection' | 'project'
>

/** Resolve Ctrl/Cmd+D to a valid scene-instance duplicate action. */
export function getCanvasDuplicateShortcutAction(
  event: KeyboardEvent,
  state: CanvasDuplicateShortcutState,
): Action | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null
  if (event.key.toLowerCase() !== 'd') return null
  if (shouldIgnoreEditorShortcut(event)) return null
  if (state.mode !== 'canvas' || state.isPlaying || !state.project) return null

  const instanceId = state.selection.entityId
  const sceneId = state.selection.sceneId ?? state.project.activeSceneId
  if (instanceId == null || !sceneId) return null
  const scene = state.project.scenes[sceneId]
  if (!scene?.instances?.some((instance) => instance.id === instanceId)) return null

  return { type: 'INSTANCE_DUPLICATE', instanceId, sceneId }
}

export function useViewportShortcuts(): void {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const state = store.getState()
      const duplicateAction = getCanvasDuplicateShortcutAction(e, state)
      if (duplicateAction) {
        e.preventDefault()
        dispatch(duplicateAction)
        return
      }

      // F (no modifiers) — frame the selected object, or fit the scene if
      // nothing is selected. Standard DCC/engine "frame selected" gesture.
      if (
        !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey
        && e.key.toLowerCase() === 'f'
        && !shouldIgnoreEditorShortcut(e)
        && state.mode === 'canvas' && !state.isPlaying
      ) {
        e.preventDefault()
        frameSelectionRegistry.invoke()
        return
      }

      if (!e.ctrlKey) return
      const { mode, editorZoom, cameraPreview } = state
      if (mode !== 'canvas') return

      const z = editorZoom

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
        dispatch({ type: 'EDITOR_SET_CAMERA_PREVIEW', enabled: !cameraPreview })
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [store, dispatch])
}
