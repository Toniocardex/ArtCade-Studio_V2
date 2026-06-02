// ---------------------------------------------------------------------------
// editor-preferences — reduce motion and future VIEW → Interface prefs
// ---------------------------------------------------------------------------

import { EDITOR_PREFERENCES_STORAGE_KEY } from '../constants/editor-preferences'

export type EditorPreferences = {
  reduceMotion: boolean
}

const DEFAULT_PREFERENCES: EditorPreferences = {
  reduceMotion: false,
}

export function readEditorPreferences(): EditorPreferences {
  if (globalThis.localStorage === undefined) return { ...DEFAULT_PREFERENCES }
  const raw = globalThis.localStorage.getItem(EDITOR_PREFERENCES_STORAGE_KEY)
  if (!raw) return { ...DEFAULT_PREFERENCES }
  try {
    const parsed = JSON.parse(raw) as Partial<EditorPreferences>
    return {
      reduceMotion: parsed.reduceMotion === true,
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function writeEditorPreferences(prefs: EditorPreferences): void {
  if (globalThis.localStorage === undefined) return
  globalThis.localStorage.setItem(EDITOR_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs))
}
