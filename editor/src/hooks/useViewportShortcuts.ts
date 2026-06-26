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
import { isBackspaceKey, isDeleteKey, shouldIgnoreEditorShortcut } from '../utils/keyboard'
import {
  EDITOR_ZOOM_DEFAULT, EDITOR_ZOOM_KEYBOARD_STEP,
  EDITOR_ZOOM_MIN, EDITOR_ZOOM_MAX,
} from '../constants/editor-viewport'

type CanvasDuplicateShortcutState = Pick<
  CoreState,
  | 'mode'
  | 'isPlaying'
  | 'selection'
  | 'project'
  | 'instanceClipboard'
  | 'snapToGrid'
  | 'editorGridSize'
>

function selectedSceneInstance(
  state: CanvasDuplicateShortcutState,
): { instanceId: number; sceneId: string } | null {
  if (state.mode !== 'canvas' || state.isPlaying || !state.project) return null
  const instanceId = state.selection.entityId
  const sceneId = state.selection.sceneId ?? state.project.activeSceneId
  if (instanceId == null || !sceneId) return null
  const scene = state.project.scenes?.[sceneId]
  if (!scene?.instances?.some((instance) => instance.id === instanceId)) return null
  return { instanceId, sceneId }
}

function selectedSceneEntityIds(state: CanvasDuplicateShortcutState): number[] {
  if (state.mode !== 'canvas' || state.isPlaying || !state.project) return []
  const sceneId = state.selection.sceneId ?? state.project.activeSceneId
  if (!sceneId) return []
  const scene = state.project.scenes?.[sceneId]
  if (!scene) return []
  const validIds = new Set(scene.instances?.map((instance) => instance.id) ?? scene.entityIds)
  const selectedIds = (state.selection.entityIds ?? []).length > 0
    ? state.selection.entityIds
    : (state.selection.entityId != null ? [state.selection.entityId] : [])
  return selectedIds.filter((id, index) =>
    validIds.has(id) && selectedIds.indexOf(id) === index,
  )
}

function clipboardPastePosition(state: CanvasDuplicateShortcutState): { x: number; y: number } | null {
  const clip = state.instanceClipboard
  if (!clip) return null
  const offset = state.snapToGrid && Number.isFinite(state.editorGridSize) && state.editorGridSize > 0
    ? state.editorGridSize
    : 16
  return {
    x: clip.instance.transform.position.x + offset,
    y: clip.instance.transform.position.y + offset,
  }
}

/** Resolve Ctrl/Cmd+D to a valid scene-instance duplicate action. */
export function getCanvasDuplicateShortcutAction(
  event: KeyboardEvent,
  state: CanvasDuplicateShortcutState,
): Action | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null
  if (event.key.toLowerCase() !== 'd') return null
  if (shouldIgnoreEditorShortcut(event)) return null
  const selected = selectedSceneInstance(state)
  if (!selected) return null

  return { type: 'INSTANCE_DUPLICATE', instanceId: selected.instanceId, sceneId: selected.sceneId }
}

export function getCanvasClipboardShortcutAction(
  event: KeyboardEvent,
  state: CanvasDuplicateShortcutState,
): Action | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null
  if (shouldIgnoreEditorShortcut(event)) return null
  const key = event.key.toLowerCase()
  if (key === 'c') {
    const selected = selectedSceneInstance(state)
    return selected
      ? { type: 'INSTANCE_COPY', instanceId: selected.instanceId, sceneId: selected.sceneId }
      : null
  }
  if (key === 'v') {
    if (state.mode !== 'canvas' || state.isPlaying || !state.project) return null
    const sceneId = state.selection.sceneId ?? state.project.activeSceneId
    if (!sceneId || !state.project.scenes?.[sceneId]) return null
    if (!state.instanceClipboard || state.instanceClipboard.sceneId !== sceneId) return null
    return { type: 'INSTANCE_PASTE', sceneId, position: clipboardPastePosition(state) ?? undefined }
  }
  return null
}

export function getCanvasDeleteShortcutAction(
  event: KeyboardEvent,
  state: CanvasDuplicateShortcutState,
): Action | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null
  if (!isDeleteKey(event) && !isBackspaceKey(event)) return null
  if (shouldIgnoreEditorShortcut(event)) return null
  const entityIds = selectedSceneEntityIds(state)
  if (entityIds.length === 0) return null
  return entityIds.length === 1
    ? { type: 'ENTITY_DELETE', entityId: entityIds[0] }
    : { type: 'ENTITY_DELETE_MANY', entityIds }
}

export function useViewportShortcuts(): void {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const state = store.getState()
      const deleteAction = getCanvasDeleteShortcutAction(e, state)
      if (deleteAction) {
        e.preventDefault()
        dispatch(deleteAction)
        return
      }
      const clipboardAction = getCanvasClipboardShortcutAction(e, state)
      if (clipboardAction) {
        e.preventDefault()
        dispatch(clipboardAction)
        return
      }
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
      // Ctrl+9 — fit to panel. PreviewPanel registers fit via useEditorFitZoom.
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
