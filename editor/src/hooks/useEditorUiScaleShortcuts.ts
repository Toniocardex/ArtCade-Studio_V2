// ---------------------------------------------------------------------------
// useEditorUiScaleShortcuts — Ctrl+Shift+=/-/0 (canvas mode uses Ctrl+= for zoom)
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { shouldIgnoreEditorShortcut } from '../utils/keyboard'

export type EditorUiScaleShortcutHandlers = {
  increaseScale: () => void
  decreaseScale: () => void
  resetScale: () => void
}

export function useEditorUiScaleShortcuts(handlers: EditorUiScaleShortcutHandlers): void {
  const { increaseScale, decreaseScale, resetScale } = handlers

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || !e.shiftKey || e.altKey) return
      if (shouldIgnoreEditorShortcut(e)) return

      if (e.key === '0') {
        e.preventDefault()
        resetScale()
        return
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        increaseScale()
        return
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        decreaseScale()
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [increaseScale, decreaseScale, resetScale])
}
