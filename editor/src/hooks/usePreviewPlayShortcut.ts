// ---------------------------------------------------------------------------
// usePreviewPlayShortcut — F5 toggles in-editor preview play/stop.
// Space must not toggle the PLAY toolbar button (game jump / input).
// ---------------------------------------------------------------------------

import { useEffect } from 'react'

export const RUN_PREVIEW_SHORTCUT_EVENT = 'artcade-run-preview-shortcut'

export function shouldTogglePreviewPlay(
  e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>,
): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return false
  return e.key === 'F5' || e.code === 'F5'
}

export function usePreviewPlayShortcut(
  onPlayStop: () => void,
): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!shouldTogglePreviewPlay(e)) return
      e.preventDefault()
      e.stopPropagation()
      onPlayStop()
    }
    function handleRunPreviewShortcut() {
      onPlayStop()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener(RUN_PREVIEW_SHORTCUT_EVENT, handleRunPreviewShortcut)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(RUN_PREVIEW_SHORTCUT_EVENT, handleRunPreviewShortcut)
    }
  }, [onPlayStop])
}
