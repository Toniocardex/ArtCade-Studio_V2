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

describe('presentation ccall readers', () => {
  const g = globalThis as unknown as Window & {
    Module?: {
      calledRun: boolean
      ccall: (...args: unknown[]) => unknown
      HEAPU8: Uint8Array
      HEAPF32: Float32Array
      _malloc: (n: number) => number
      _free: (ptr: number) => void
    }
  }

  beforeEach(() => {
    vi.resetModules()
    delete g.Module
  })

  it('returns numeric presentation revisions from ccall', async () => {
    g.Module = {
      calledRun: true,
      ccall: (name: unknown) => name === 'editor_get_presentation_revision' ? 42 : 0,
      HEAPU8: new Uint8Array(128),
      HEAPF32: new Float32Array(32),
      _malloc: () => 0,
      _free: () => {},
    }
    const { editorGetPresentationRevision } = await import('./wasm-bridge')
    expect(editorGetPresentationRevision()).toBe(42)
  })

  it('reads presentation snapshots from the ccall pointer', async () => {
    const heap = new Uint8Array(160)
    const ptr = 64
    const view = new DataView(heap.buffer)
    view.setUint32(ptr + 0, 1, true)
    view.setUint32(ptr + 4, 64, true)
    view.setBigUint64(ptr + 8, 7n, true)
    view.setUint32(ptr + 16, 2, true)
    view.setUint32(ptr + 20, 1, true)
    view.setFloat32(ptr + 24, 1200, true)
    view.setFloat32(ptr + 28, 900, true)
    view.setFloat32(ptr + 32, 320, true)
    view.setFloat32(ptr + 36, 180, true)
    view.setFloat32(ptr + 40, 100, true)
    view.setFloat32(ptr + 44, 50, true)
    view.setFloat32(ptr + 48, 640, true)
    view.setFloat32(ptr + 52, 360, true)
    view.setFloat32(ptr + 56, 2, true)
    view.setFloat32(ptr + 60, 2, true)

    g.Module = {
      calledRun: true,
      ccall: (name: unknown) => name === 'editor_get_presentation_snapshot' ? ptr : 0,
      HEAPU8: heap,
      HEAPF32: new Float32Array(heap.buffer),
      _malloc: () => 0,
      _free: () => {},
    }
    const { editorReadPresentationSnapshot } = await import('./wasm-bridge')
    expect(editorReadPresentationSnapshot()).toMatchObject({
      revision: 7n,
      effectiveMode: 'playEmbedded',
      surfaceFramebuffer: { width: 1200, height: 900 },
    })
  })
})
