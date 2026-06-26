import { useEffect, useState } from 'react'
import { getPresentationSnapshot, onPresentationChanged } from '../utils/presentation-store'
import {
  DEFAULT_EDITOR_CAMERA_VIEW,
  editorViewFromSnapshot,
} from '../utils/editor-camera-from-snapshot'
import type { EditorViewState } from '../utils/wasm-bridge'
import { runtimeSync } from '../utils/runtime-sync-service'

function readEditorViewFromStore(): EditorViewState {
  const snapshot = getPresentationSnapshot()
  if (!snapshot) return DEFAULT_EDITOR_CAMERA_VIEW
  return editorViewFromSnapshot(snapshot)
}

/**
 * Re-renders when the committed presentation snapshot advances.
 * Reads editor camera fields from the same revision as rulers and overlays.
 */
export function useEditorCameraView(): EditorViewState {
  const [view, setView] = useState<EditorViewState>(readEditorViewFromStore)

  useEffect(() => {
    const publish = () => setView(readEditorViewFromStore())
    publish()
    return onPresentationChanged(() => publish())
  }, [])

  useEffect(() => runtimeSync.onReadyChange((ready) => {
    if (ready) setView(readEditorViewFromStore())
  }), [])

  return view
}
