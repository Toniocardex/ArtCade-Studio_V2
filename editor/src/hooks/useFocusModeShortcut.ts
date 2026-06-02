// ---------------------------------------------------------------------------
// useFocusModeShortcut — F11 toggles canvas focus mode (ADAPTIVE_LAYOUT Phase 2)
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useEditor } from '../store/editor-store'
import { shouldIgnoreEditorShortcut } from '../utils/keyboard'

export function useFocusModeShortcut(): void {
  const { dispatch } = useEditor()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'F11') return
      if (shouldIgnoreEditorShortcut(e)) return
      e.preventDefault()
      dispatch({ type: 'TOGGLE_FOCUS_MODE' })
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [dispatch])
}

export function useExitFocusOnEscape(): void {
  const { state, dispatch } = useEditor()

  useEffect(() => {
    if (!state.focusMode) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (shouldIgnoreEditorShortcut(e)) return
      e.preventDefault()
      dispatch({ type: 'SET_FOCUS_MODE', enabled: false })
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [state.focusMode, dispatch])
}
