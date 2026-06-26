import { useEffect, useState } from 'react'
import { onPresentationChanged } from '../utils/presentation-store'
import { editorReadEditorView, type EditorViewState } from '../utils/wasm-bridge'
import { runtimeSync } from '../utils/runtime-sync-service'

const DEFAULT_VIEW: EditorViewState = { x: 0, y: 0, zoomDevice: 1 }

/**
 * Re-renders when the WASM editor camera advances (presentation revision).
 */
export function useEditorCameraView(): EditorViewState {
  const [view, setView] = useState<EditorViewState>(() => {
    try {
      return editorReadEditorView()
    } catch {
      return DEFAULT_VIEW
    }
  })

  useEffect(() => {
    const publish = () => {
      try {
        setView(editorReadEditorView())
      } catch {
        setView(DEFAULT_VIEW)
      }
    }
    publish()
    return onPresentationChanged(() => publish())
  }, [])

  useEffect(() => runtimeSync.onReadyChange((ready) => {
    if (ready) {
      try {
        setView(editorReadEditorView())
      } catch {
        setView(DEFAULT_VIEW)
      }
    }
  }), [])

  return view
}
