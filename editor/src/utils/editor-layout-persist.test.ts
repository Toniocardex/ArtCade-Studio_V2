import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  layoutStorageKey,
  readEditorLayoutSnapshot,
  writeEditorLayoutSnapshot,
  clampLeftWidth,
  clampLeftWidthInWorkspace,
  clearEditorLayoutSnapshot,
} from './editor-layout-persist'

let store: Record<string, string>

beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  })
})

describe('editor-layout-persist', () => {
  it('layoutStorageKey uses rounded WxH', () => {
    expect(layoutStorageKey(1366.2, 768.7)).toBe('artcade.layout-v2::1366x769')
  })

  it('write and read round-trip', () => {
    writeEditorLayoutSnapshot(1920, 1080, {
      leftW: 300,
      rightW: 320,
      dockH: 240,
      dockCollapsed: true,
    })
    const snap = readEditorLayoutSnapshot(1920, 1080)
    expect(snap.leftW).toBe(300)
    expect(snap.dockCollapsed).toBe(true)
  })

  it('clampLeftWidth snaps near preset', () => {
    expect(clampLeftWidth(238)).toBe(240)
  })

  it('clampLeftWidthInWorkspace reserves canvas minimum width', () => {
    expect(clampLeftWidthInWorkspace(320, 900, 320)).toBeLessThanOrEqual(900 - 320 - 400)
  })

  it('clearEditorLayoutSnapshot removes bucket', () => {
    writeEditorLayoutSnapshot(1280, 720, {
      leftW: 200,
      rightW: 280,
      dockH: 200,
      dockCollapsed: false,
    })
    clearEditorLayoutSnapshot(1280, 720)
    expect(store[layoutStorageKey(1280, 720)]).toBeUndefined()
  })
})
