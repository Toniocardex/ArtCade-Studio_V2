// ---------------------------------------------------------------------------
// usePreviewPlayShortcut — P toggles in-editor preview play/stop (canvas mode).
// Space must not toggle the PLAY toolbar button (game jump / input).
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { shouldIgnoreEditorShortcut } from '../utils/keyboard'

export function shouldTogglePreviewPlay(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>,
  mode: string,
): boolean {
  if (mode !== 'canvas') return false
  if (e.ctrlKey || e.altKey || e.metaKey) return false
  if (e.key !== 'p' && e.key !== 'P') return false
  return true
}

export function usePreviewPlayShortcut(
  mode: string,
  onPlayStop: () => void,
): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!shouldTogglePreviewPlay(e, mode)) return
      if (shouldIgnoreEditorShortcut(e)) return
      e.preventDefault()
      e.stopPropagation()
      onPlayStop()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, onPlayStop])
}
