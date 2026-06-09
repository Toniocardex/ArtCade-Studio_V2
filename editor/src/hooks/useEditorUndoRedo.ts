// ---------------------------------------------------------------------------
// Global project undo/redo shortcuts (canvas, inspector, Logic Board, …).
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useEditorDispatch } from '../store/editor-store'
import { shouldIgnoreEditorShortcut } from '../utils/keyboard'

export function useEditorUndoRedo(): void {
  const dispatch = useEditorDispatch()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      if (shouldIgnoreEditorShortcut(e)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ type: 'PROJECT_UNDO' })
        return
      }
      if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        dispatch({ type: 'PROJECT_REDO' })
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dispatch])
}
