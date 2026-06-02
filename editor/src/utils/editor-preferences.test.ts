import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readEditorPreferences, writeEditorPreferences } from './editor-preferences'
import { EDITOR_PREFERENCES_STORAGE_KEY } from '../constants/editor-preferences'

let store: Record<string, string>

beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  })
})

describe('editor-preferences', () => {
  it('defaults reduceMotion to false', () => {
    expect(readEditorPreferences().reduceMotion).toBe(false)
  })

  it('persists reduceMotion', () => {
    writeEditorPreferences({ reduceMotion: true })
    expect(readEditorPreferences().reduceMotion).toBe(true)
    expect(store[EDITOR_PREFERENCES_STORAGE_KEY]).toContain('reduceMotion')
  })
})
