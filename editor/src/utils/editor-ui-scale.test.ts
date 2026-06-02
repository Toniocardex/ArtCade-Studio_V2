import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  suggestEditorUiScale,
  readStoredEditorUiScale,
  resolveInitialEditorUiScale,
  stepEditorUiScale,
  formatEditorUiScalePercent,
  clampToEditorUiScale,
  writeStoredEditorUiScale,
} from './editor-ui-scale'
import { EDITOR_UI_SCALE_STORAGE_KEY } from '../constants/editor-ui-scale'

let store: Record<string, string>

beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  })
})

describe('editor-ui-scale', () => {
  it('suggestEditorUiScale maps resolution bands', () => {
    expect(suggestEditorUiScale(1920, 1080)).toBe(1)
    expect(suggestEditorUiScale(1366, 768)).toBe(0.85)
    expect(suggestEditorUiScale(1280, 720)).toBe(0.75)
    expect(suggestEditorUiScale(2560, 1440)).toBe(1.15)
    expect(suggestEditorUiScale(1600, 900)).toBe(0.9)
  })

  it('resolveInitialEditorUiScale prefers stored value', () => {
    store[EDITOR_UI_SCALE_STORAGE_KEY] = '1.15'
    expect(resolveInitialEditorUiScale(1366, 768)).toBe(1.15)
  })

  it('resolveInitialEditorUiScale auto-detects when unset', () => {
    expect(resolveInitialEditorUiScale(1366, 768)).toBe(0.85)
  })

  it('stepEditorUiScale moves along ladder', () => {
    expect(stepEditorUiScale(1, 1)).toBe(1.15)
    expect(stepEditorUiScale(1, -1)).toBe(0.9)
    expect(stepEditorUiScale(0.75, -1)).toBe(0.75)
    expect(stepEditorUiScale(1.25, 1)).toBe(1.25)
  })

  it('formatEditorUiScalePercent', () => {
    expect(formatEditorUiScalePercent(0.85)).toBe('85%')
  })

  it('clampToEditorUiScale snaps to nearest step', () => {
    expect(clampToEditorUiScale(0.88)).toBe(0.9)
  })

  it('read/write round-trip', () => {
    writeStoredEditorUiScale(0.85)
    expect(readStoredEditorUiScale()).toBe(0.85)
  })
})
