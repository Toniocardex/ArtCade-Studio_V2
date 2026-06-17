import { describe, it, expect, beforeEach, vi } from 'vitest'

// Vitest runs in node by default; wasm-bridge touches globalThis at import
// time (HMR rehydration). Callbacks are bound on globalThis (Emscripten contract).

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bindWindowCallbacks } = await import('./wasm-bridge')

const win = globalThis as unknown as Window

describe('bindWindowCallbacks (merge-safe)', () => {
  beforeEach(() => {
    delete win.onEditorCursorWorld
    delete win.onEntitySelected
    delete win.onEntityDuplicateRequested
    delete win.onEntityTransformChanged
    delete win.onConsoleLine
    delete win.onRuntimeProfile
  })

  it('binds all callbacks on first call', () => {
    const onEntitySelected = () => {}
    const onEntityDuplicateRequested = () => {}
    const onEntityTransformChanged = () => {}
    const onConsoleLine = () => {}

    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected,
      onEntityDuplicateRequested,
      onEntityTransformChanged,
      onConsoleLine,
    })

    expect(win.onEntitySelected).toBe(onEntitySelected)
    expect(win.onEntityDuplicateRequested).toBe(onEntityDuplicateRequested)
    expect(win.onEntityTransformChanged).toBe(onEntityTransformChanged)
    expect(win.onConsoleLine).toBe(onConsoleLine)
  })

  it('preserves onRuntimeProfile when a later rebind omits it', () => {
    const onRuntimeProfile = () => {}
    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected: () => {},
      onEntityTransformChanged: () => {},
      onConsoleLine: () => {},
      onRuntimeProfile,
    })
    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected: () => {},
      onEntityTransformChanged: () => {},
      onConsoleLine: () => {},
    })
    expect(win.onRuntimeProfile).toBe(onRuntimeProfile)
  })

  it('preserves onEditorCursorWorld when a later rebind omits it', () => {
    const onEditorCursorWorld = () => {}
    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected: () => {},
      onEntityTransformChanged: () => {},
      onConsoleLine: () => {},
      onEditorCursorWorld,
    })
    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected: () => {},
      onEntityTransformChanged: () => {},
      onConsoleLine: () => {},
    })
    expect(win.onEditorCursorWorld).toBe(onEditorCursorWorld)
  })

})

describe('editorReloadScript', () => {
  const g = globalThis as unknown as Window & {
    Module?: {
      calledRun: boolean
      ccall: (...args: unknown[]) => unknown
      lengthBytesUTF8: (s: string) => number
      stringToUTF8: (s: string, ptr: number, max: number) => void
      _malloc: (n: number) => number
      _free: (ptr: number) => void
    }
  }

  function stubModule(ccall: (...args: unknown[]) => unknown) {
    g.Module = {
      calledRun: true,
      ccall,
      lengthBytesUTF8: () => 8,
      stringToUTF8: () => {},
      _malloc: () => 64,
      _free: () => {},
    }
  }

  it('returns false when ccall throws', async () => {
    vi.resetModules()
    stubModule(() => {
      throw new Error('reload failed')
    })
    const { editorReloadScript } = await import('./wasm-bridge')
    expect(editorReloadScript('function tick() end')).toBe(-1)
  })

  it('returns true when ccall succeeds', async () => {
    vi.resetModules()
    stubModule(() => 0)
    const { editorReloadScript } = await import('./wasm-bridge')
    expect(editorReloadScript('function tick() end')).toBe(0)
  })
})
