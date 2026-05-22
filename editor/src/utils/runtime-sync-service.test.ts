import { describe, it, expect, beforeEach, vi } from 'vitest'

// Globals shim — wasm-bridge touches `window` at import time. Set it BEFORE
// importing the service (the service in turn imports wasm-bridge).
;(globalThis as unknown as { window: Record<string, unknown> }).window =
  (globalThis as unknown as { window?: Record<string, unknown> }).window ?? {}

// Stub wasm-bridge before the service module evaluates. `runtimeSync` is built
// on top of the wrappers in this mock so every assertion can be done by
// counting calls and inspecting args.
vi.mock('./wasm-bridge', () => {
  return {
    isReady: vi.fn(() => true),
    editorLoadProject:        vi.fn(),
    editorRestoreFromProject: vi.fn(),
    editorReloadScript:       vi.fn(),
    editorSetMode:            vi.fn(),
    editorSelectEntity:       vi.fn(),
    editorDeselect:           vi.fn(),
    editorSetTool:            vi.fn(),
    editorSetSelectedTile:    vi.fn(),
    editorSetGuidesEnabled:   vi.fn(),
    editorSetGridSize:        vi.fn(),
    editorSetTransform:       vi.fn(),
    editorUpdateEntity:       vi.fn(),
    editorSetSceneSettings:   vi.fn(),
  }
})

const bridge = await import('./wasm-bridge')
const { runtimeSync } = await import('./runtime-sync-service')

function makeProject() {
  const project = {
    projectName: 'T', version: '1', activeSceneId: 'a',
    mainScriptPath: 'm.lua',
    targetFPS: 60,
    entities: {
      1: {
        id: 1, name: 'P', className: 'Player', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: {
          spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 },
          alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0,
        },
      },
    },
    scenes: {
      a: {
        id: 'a', name: 'A',
        worldSize: { x: 800, y: 600 }, viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1],
      },
    },
  }
  return project
}
type Project = ReturnType<typeof makeProject>

describe('RuntimeSyncService', () => {
  beforeEach(() => {
    runtimeSync.reset()
    vi.mocked(bridge.isReady).mockReturnValue(true)
    vi.mocked(bridge.editorLoadProject).mockReset()
    vi.mocked(bridge.editorRestoreFromProject).mockReset()
    vi.mocked(bridge.editorReloadScript).mockReset()
    vi.mocked(bridge.editorSetMode).mockReset()
    vi.mocked(bridge.editorSelectEntity).mockReset()
    vi.mocked(bridge.editorDeselect).mockReset()
    vi.mocked(bridge.editorSetTool).mockReset()
    vi.mocked(bridge.editorSetSelectedTile).mockReset()
    vi.mocked(bridge.editorSetGuidesEnabled).mockReset()
    vi.mocked(bridge.editorSetGridSize).mockReset()
    vi.mocked(bridge.editorSetTransform).mockReset()
    vi.mocked(bridge.editorUpdateEntity).mockReset()
    vi.mocked(bridge.editorSetSceneSettings).mockReset()
  })

  it('skips every call until the runtime is ready', () => {
    vi.mocked(bridge.isReady).mockReturnValue(false)
    runtimeSync.syncPlayMode(true)
    runtimeSync.syncSelection(7)
    runtimeSync.syncEditorTool('select', 0)
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, isPlaying: false })
    expect(bridge.editorSetMode).not.toHaveBeenCalled()
    expect(bridge.editorSelectEntity).not.toHaveBeenCalled()
    expect(bridge.editorSetTool).not.toHaveBeenCalled()
    expect(bridge.editorSetGuidesEnabled).not.toHaveBeenCalled()
  })

  it('syncProject loads once and skips when the fingerprint is unchanged', () => {
    const p = makeProject()
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(true)
    expect(bridge.editorLoadProject).toHaveBeenCalledTimes(1)
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(false)
    expect(bridge.editorLoadProject).toHaveBeenCalledTimes(1)
  })

  it('syncProject re-loads when the fingerprint changes', () => {
    const p: Project = makeProject()
    runtimeSync.syncProject(p as never, 'a', '/tmp/x')
    p.entities[1].sprite.tint = { x: 1, y: 0, z: 0, w: 1 }
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(true)
    expect(bridge.editorUpdateEntity).toHaveBeenCalledTimes(1)
    expect(bridge.editorUpdateEntity).toHaveBeenCalledWith(1, expect.any(String))
    expect(bridge.editorLoadProject).toHaveBeenCalledTimes(1)
  })

  it('syncProject uses editor_set_scene_settings for viewport-only edits', () => {
    const p: Project = makeProject()
    runtimeSync.syncProject(p as never, 'a', '/tmp/x')
    p.scenes.a.viewportSize = { x: 1024, y: 768 }
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(true)
    expect(bridge.editorSetSceneSettings).toHaveBeenCalledTimes(1)
    expect(bridge.editorSetSceneSettings).toHaveBeenCalledWith('a', expect.any(String))
    expect(bridge.editorLoadProject).toHaveBeenCalledTimes(1)
  })

  it('syncProject full-reloads when entity membership changes', () => {
    const p: Project = makeProject()
    runtimeSync.syncProject(p as never, 'a', '/tmp/x')
    ;(p.entities as Record<number, (typeof p.entities)[1]>)[2] = {
      ...p.entities[1],
      id: 2,
      name: 'E2',
    }
    p.scenes.a.entityIds = [1, 2]
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(true)
    expect(bridge.editorLoadProject).toHaveBeenCalledTimes(2)
    expect(bridge.editorUpdateEntity).not.toHaveBeenCalled()
  })

  it('syncPlayMode dedupes by latched value', () => {
    runtimeSync.syncPlayMode(true)
    runtimeSync.syncPlayMode(true)
    runtimeSync.syncPlayMode(false)
    expect(bridge.editorSetMode).toHaveBeenCalledTimes(2)
    expect(bridge.editorSetMode).toHaveBeenNthCalledWith(1, 1)
    expect(bridge.editorSetMode).toHaveBeenNthCalledWith(2, 0)
  })

  it('syncSelection swaps between select/deselect and dedupes', () => {
    runtimeSync.syncSelection(3)
    runtimeSync.syncSelection(3)
    runtimeSync.syncSelection(null)
    runtimeSync.syncSelection(null)
    runtimeSync.syncSelection(4)
    expect(bridge.editorSelectEntity).toHaveBeenCalledTimes(2)
    expect(bridge.editorDeselect).toHaveBeenCalledTimes(1)
  })

  it('syncEditorTool sends tool change once and only forwards brush when painting', () => {
    runtimeSync.syncEditorTool('select', 5)
    expect(bridge.editorSetTool).toHaveBeenCalledTimes(1)
    expect(bridge.editorSetSelectedTile).not.toHaveBeenCalled()

    runtimeSync.syncEditorTool('tile', 5)
    expect(bridge.editorSetTool).toHaveBeenCalledTimes(2)
    expect(bridge.editorSetSelectedTile).toHaveBeenLastCalledWith(5)

    runtimeSync.syncEditorTool('tile', 5)
    expect(bridge.editorSetTool).toHaveBeenCalledTimes(2)
    expect(bridge.editorSetSelectedTile).toHaveBeenCalledTimes(1)

    runtimeSync.syncEditorTool('erase', 5)
    expect(bridge.editorSetSelectedTile).toHaveBeenLastCalledWith(0)
  })

  it('syncEditorChrome forces guides off while playing', () => {
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, isPlaying: false })
    expect(bridge.editorSetGuidesEnabled).toHaveBeenLastCalledWith(true)
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, isPlaying: true })
    expect(bridge.editorSetGuidesEnabled).toHaveBeenLastCalledWith(false)
    // gridSize did not change → still only one call
    expect(bridge.editorSetGridSize).toHaveBeenCalledTimes(1)
  })

  it('syncEntityTransform skips identical pushes within epsilon', () => {
    const snap = { entityId: 1, x: 100, y: 200, rotation: 0.5, scaleX: 2, scaleY: 1 }
    expect(runtimeSync.syncEntityTransform(snap)).toBe(true)
    expect(bridge.editorSetTransform).toHaveBeenCalledTimes(1)
    expect(runtimeSync.syncEntityTransform({ ...snap, x: 100 + 1e-6 })).toBe(false)
    expect(bridge.editorSetTransform).toHaveBeenCalledTimes(1)
    expect(runtimeSync.syncEntityTransform({ ...snap, x: 101 })).toBe(true)
    expect(bridge.editorSetTransform).toHaveBeenCalledTimes(2)
  })

  it('noteTransform suppresses a subsequent identical sync', () => {
    const snap = { entityId: 1, x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 }
    runtimeSync.noteTransform(snap)
    expect(runtimeSync.syncEntityTransform(snap)).toBe(false)
    expect(bridge.editorSetTransform).not.toHaveBeenCalled()
  })

  it('reset clears every latched value', () => {
    runtimeSync.syncPlayMode(true)
    runtimeSync.reset()
    runtimeSync.syncPlayMode(true)
    expect(bridge.editorSetMode).toHaveBeenCalledTimes(2)
  })

  it('restorePreviewFromProject sets EDIT mode before restore and reload', () => {
    const p = makeProject()
    const invalidator = vi.fn()
    runtimeSync.setAssetCacheInvalidator(invalidator)
    runtimeSync.syncProject(p as never, 'a', '/tmp/x')
    vi.mocked(bridge.editorSetMode).mockClear()
    vi.mocked(bridge.editorRestoreFromProject).mockClear()
    vi.mocked(bridge.editorReloadScript).mockClear()
    runtimeSync.restorePreviewFromProject(p as never, 'a', 'function tick(dt) end')
    expect(bridge.editorSetMode).toHaveBeenCalledWith(0)
    expect(bridge.editorRestoreFromProject).toHaveBeenCalledTimes(1)
    expect(bridge.editorReloadScript).toHaveBeenCalledWith('function tick(dt) end')
    expect(invalidator).toHaveBeenCalledTimes(1)
    const setModeOrder = vi.mocked(bridge.editorSetMode).mock.invocationCallOrder[0]
    const restoreOrder = vi.mocked(bridge.editorRestoreFromProject).mock.invocationCallOrder[0]
    const reloadOrder = vi.mocked(bridge.editorReloadScript).mock.invocationCallOrder[0]
    expect(setModeOrder).toBeLessThan(restoreOrder)
    expect(restoreOrder).toBeLessThan(reloadOrder)
    // After reset(), a repeat sync should load again.
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(true)
    expect(bridge.editorLoadProject).toHaveBeenCalledTimes(2)
  })
})
