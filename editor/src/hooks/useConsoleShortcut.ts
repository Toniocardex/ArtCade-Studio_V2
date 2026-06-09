// ---------------------------------------------------------------------------
// useConsoleShortcut — Ctrl+` toggles the console overlay globally.
// ---------------------------------------------------------------------------
//
// The backquote shortcut works regardless of the current mode (canvas / logic /
// script): we always want the console reachable. We don't preventDefault when
// the focused element is a typing surface and the shortcut isn't Ctrl-prefixed,
// so this only triggers on the explicit combo.

import { useEffect } from 'react'
import { useEditorDispatch } from '../store/editor-store'

export function useConsoleShortcut(): void {
  const dispatch = useEditorDispatch()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.ctrlKey) return
      if (e.code !== 'Backquote') return
      e.preventDefault()
      e.stopPropagation()
      dispatch({ type: 'TOGGLE_CONSOLE' })
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [dispatch])
}
