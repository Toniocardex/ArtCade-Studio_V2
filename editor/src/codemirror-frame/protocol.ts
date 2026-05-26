export type CmFrameThemeId = 'artcade-dark' | 'artcade-light'

export type ParentToFrameMessage =
  | { type: 'init'; value: string; theme: CmFrameThemeId }
  | { type: 'set-theme'; theme: CmFrameThemeId }
  /** Parent store updated externally (e.g. Logic Board → Lua); not from iframe typing. */
  | { type: 'update-from-logic'; value: string }

export type FrameToParentMessage =
  | { type: 'ready' }
  | { type: 'change'; value: string }
  | { type: 'run-preview-shortcut' }

export function isParentToFrameMessage(data: unknown): data is ParentToFrameMessage {
  if (!data || typeof data !== 'object') return false
  const t = (data as { type?: string }).type
  return t === 'init' || t === 'set-theme' || t === 'update-from-logic'
}

export function isFrameToParentMessage(data: unknown): data is FrameToParentMessage {
  if (!data || typeof data !== 'object') return false
  const t = (data as { type?: string }).type
  return t === 'ready' || t === 'change' || t === 'run-preview-shortcut'
}
