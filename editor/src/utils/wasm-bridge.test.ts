import { describe, it, expect, beforeEach, vi } from 'vitest'

// Vitest runs in node by default; wasm-bridge touches globalThis at import
// time (HMR rehydration). Callbacks are bound on globalThis (Emscripten contract).

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bindWindowCallbacks } = await import('./wasm-bridge')

const win = globalThis as unknown as Window

describe('bindWindowCallbacks (merge-safe)', () => {
  beforeEach(() => {
    delete win.onTilemapPainted
    delete win.onEditorCursorWorld
    delete win.onEntitySelected
    delete win.onEntityTransformChanged
    delete win.onConsoleLine
    delete win.onRuntimeProfile
  })

  it('binds all callbacks on first call', () => {
    const onTilemapPainted = () => {}
    const onEntitySelected = () => {}
    const onEntityTransformChanged = () => {}
    const onConsoleLine = () => {}

    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected,
      onEntityTransformChanged,
      onConsoleLine,
      onTilemapPainted,
    })

    expect(win.onEntitySelected).toBe(onEntitySelected)
    expect(win.onEntityTransformChanged).toBe(onEntityTransformChanged)
    expect(win.onConsoleLine).toBe(onConsoleLine)
    expect(win.onTilemapPainted).toBe(onTilemapPainted)
  })

  it('preserves onTilemapPainted when a later rebind omits it', () => {
    const onTilemapPainted = () => {}
    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected: () => {},
      onEntityTransformChanged: () => {},
      onConsoleLine: () => {},
      onTilemapPainted,
    })

    // Simulate the canvas-rebind path that historically passed a partial
    // callback set (no onTilemapPainted) and clobbered the binding.
    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected: () => {},
      onEntityTransformChanged: () => {},
      onConsoleLine: () => {},
    })

    expect(win.onTilemapPainted).toBe(onTilemapPainted)
  })

  it('updates onTilemapPainted when a new one is provided', () => {
    const first = () => {}
    const second = () => {}
    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected: () => {},
      onEntityTransformChanged: () => {},
      onConsoleLine: () => {},
      onTilemapPainted: first,
    })
    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected: () => {},
      onEntityTransformChanged: () => {},
      onConsoleLine: () => {},
      onTilemapPainted: second,
    })
    expect(win.onTilemapPainted).toBe(second)
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
