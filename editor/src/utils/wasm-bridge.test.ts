import { describe, it, expect, beforeEach } from 'vitest'

// Vitest runs in node by default; wasm-bridge accesses `window` at import
// time (HMR rehydration). Provide a minimal shim BEFORE importing the module.
;(globalThis as unknown as { window: Record<string, unknown> }).window =
  (globalThis as unknown as { window?: Record<string, unknown> }).window ?? {}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bindWindowCallbacks } = await import('./wasm-bridge')

declare global {
  interface Window {
    onTilemapPainted?: (col: number, row: number, tileId: number) => void
    onEntitySelected?: (entityId: number) => void
    onEntityTransformChanged?: (
      entityId: number, x: number, y: number,
      rot: number, sx: number, sy: number,
    ) => void
    onConsoleLine?: (message: string, level: string) => void
    onObjectUpdated?: (x: number, y: number) => void
  }
}

const win = (globalThis as unknown as { window: Window }).window

describe('bindWindowCallbacks (merge-safe)', () => {
  beforeEach(() => {
    delete win.onTilemapPainted
    delete win.onEntitySelected
    delete win.onEntityTransformChanged
    delete win.onConsoleLine
    delete win.onObjectUpdated
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
    expect(typeof win.onObjectUpdated).toBe('function')
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

  it('onObjectUpdated forwards through the latest transform callback', () => {
    const calls: Array<[number, number, number, number, number, number]> = []
    bindWindowCallbacks({
      onReady: () => {},
      onEntitySelected: () => {},
      onEntityTransformChanged: (id, x, y, rot, sx, sy) => {
        calls.push([id, x, y, rot, sx, sy])
      },
      onConsoleLine: () => {},
    })
    win.onObjectUpdated?.(10, 20)
    expect(calls).toEqual([[0, 10, 20, 0, 1, 1]])
  })
})
