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
    editorLoadDialogs:        vi.fn(),
    editorRestoreFromProject: vi.fn(),
    editorReloadScript:       vi.fn(() => 0),
    editorEnterPlayMode:      vi.fn(() => 0),
    editorExitPlayMode:       vi.fn(() => 0),
    EditorApiResult: { Ok: 0, JsonError: 1, LuaError: 2, NotWired: 3 },
    EDITOR_API_CCALL_FAILED: -1,
    editorSetMode:            vi.fn(),
    editorSelectEntity:       vi.fn(),
    editorSelectEntities:     vi.fn(),
    editorDeselect:           vi.fn(),
    editorSetTool:            vi.fn(),
    editorSetGuidesEnabled:   vi.fn(),
    editorSetGridSize:        vi.fn(),
    editorSetSnapToGrid:      vi.fn(),
    editorSetTransform:       vi.fn(),
    editorUpdateEntity:       vi.fn(),
    editorSetSceneSettings:   vi.fn(),
    editorSyncTilemapData:    vi.fn(() => true),
    editorSyncTilemapLayers:  vi.fn(() => true),
    peekWasmBridgeLastError:  vi.fn(() => 'mock bridge error'),
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
          spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 },
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
    // Reset with WASM "unloaded" so engineReady is always cleared between cases.
    vi.mocked(bridge.isReady).mockReturnValue(false)
    runtimeSync.reset()
    vi.mocked(bridge.isReady).mockReturnValue(true)
    vi.mocked(bridge.editorLoadProject).mockReset()
    vi.mocked(bridge.editorLoadDialogs).mockReset()
    vi.mocked(bridge.editorRestoreFromProject).mockReset()
    vi.mocked(bridge.editorReloadScript).mockReset()
    vi.mocked(bridge.editorReloadScript).mockReturnValue(0)
    vi.mocked(bridge.editorEnterPlayMode).mockReset()
    vi.mocked(bridge.editorEnterPlayMode).mockReturnValue(0)
    vi.mocked(bridge.editorExitPlayMode).mockReset()
    vi.mocked(bridge.editorExitPlayMode).mockReturnValue(0)
    vi.mocked(bridge.editorSetMode).mockReset()
    vi.mocked(bridge.editorSelectEntity).mockReset()
    vi.mocked(bridge.editorSelectEntities).mockReset()
    vi.mocked(bridge.editorDeselect).mockReset()
    vi.mocked(bridge.editorSetTool).mockReset()
    vi.mocked(bridge.editorSetGuidesEnabled).mockReset()
    vi.mocked(bridge.editorSetGridSize).mockReset()
    vi.mocked(bridge.editorSetTransform).mockReset()
    vi.mocked(bridge.editorUpdateEntity).mockReset()
    vi.mocked(bridge.editorSetSceneSettings).mockReset()
    vi.mocked(bridge.editorSyncTilemapData).mockReset()
    vi.mocked(bridge.editorSyncTilemapData).mockReturnValue(true)
    vi.mocked(bridge.editorSyncTilemapLayers).mockReset()
    vi.mocked(bridge.editorSyncTilemapLayers).mockReturnValue(true)
  })

  it('skips every call until the runtime is ready', () => {
    vi.mocked(bridge.isReady).mockReturnValue(false)
    runtimeSync.syncPlayMode(true)
    runtimeSync.syncSelection(7)
    runtimeSync.syncEditorTool('select')
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, snapToGrid: false, isPlaying: false })
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

  it('notifies project reload listeners only when a full runtime reload is applied', () => {
    const listener = vi.fn()
    const unsubscribe = runtimeSync.onProjectReloadApplied(listener)
    const p = makeProject()

    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)

    Object.assign(p, { layers: [{ name: 'Object' }, { name: 'Background' }] })
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    Object.assign(p, { layers: [{ name: 'UI' }, { name: 'Object' }, { name: 'Background' }] })
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(2)
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

  it('syncProject hot-reloads main Lua when only the script changes', () => {
    const p = makeProject()
    runtimeSync.syncProject(p as never, 'a', '/tmp/x', { mainLua: 'function tick(dt) end' })
    vi.mocked(bridge.editorReloadScript).mockClear()
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x', {
      mainLua: '-- logic v2',
    })).toBe(true)
    expect(bridge.editorLoadProject).toHaveBeenCalledTimes(1)
    expect(bridge.editorReloadScript).toHaveBeenCalledWith('-- logic v2')
  })

  it('syncProject full-reload hot-reloads main Lua when provided', () => {
    const p = makeProject()
    ;(p.entities as Record<number, (typeof p.entities)[1]>)[2] = {
      ...p.entities[1],
      id: 2,
      name: 'E2',
    }
    p.scenes.a.entityIds = [1, 2]
    runtimeSync.syncProject(p as never, 'a', '/tmp/x', { mainLua: 'function tick(dt) end' })
    expect(bridge.editorLoadProject).toHaveBeenCalledTimes(1)
    expect(bridge.editorReloadScript).toHaveBeenCalledWith('function tick(dt) end')
  })

  it('syncProject omits logicBoards from runtime JSON payload', () => {
    const p = makeProject()
    Object.assign(p, { logicBoards: [{ id: 'lb', name: 'Main', rules: [] }] })
    runtimeSync.syncProject(p as never, 'a', '/tmp/x')
    const json = vi.mocked(bridge.editorLoadProject).mock.calls[0][0]
    const parsed = JSON.parse(json) as Record<string, unknown>
    expect(parsed.logicBoards).toBeUndefined()
    expect(parsed.entities).toBeDefined()
    expect(parsed.activeSceneId).toBe('a')
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

  it('syncSelection sends multi-selected ids as one bridge update', () => {
    runtimeSync.syncSelection(5, [5, 3])
    runtimeSync.syncSelection(5, [3, 5])

    expect(bridge.editorSelectEntity).not.toHaveBeenCalled()
    expect(bridge.editorSelectEntities).toHaveBeenCalledTimes(1)
    expect(bridge.editorSelectEntities).toHaveBeenCalledWith([3, 5])

    runtimeSync.syncSelection(3, [3])
    expect(bridge.editorSelectEntity).toHaveBeenCalledWith(3)
  })

  it('syncEditorTool sends tool change once and dedupes repeats', () => {
    runtimeSync.syncEditorTool('select')
    expect(bridge.editorSetTool).toHaveBeenCalledTimes(1)
    expect(bridge.editorSetTool).toHaveBeenLastCalledWith(0)

    runtimeSync.syncEditorTool('pan')
    expect(bridge.editorSetTool).toHaveBeenCalledTimes(2)
    expect(bridge.editorSetTool).toHaveBeenLastCalledWith(1)

    runtimeSync.syncEditorTool('pan')
    expect(bridge.editorSetTool).toHaveBeenCalledTimes(2)
  })

  it('syncEditorChrome forces guides off while playing', () => {
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, snapToGrid: false, isPlaying: false })
    expect(bridge.editorSetGuidesEnabled).toHaveBeenLastCalledWith(true)
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, snapToGrid: false, isPlaying: true })
    expect(bridge.editorSetGuidesEnabled).toHaveBeenLastCalledWith(false)
    // gridSize did not change → still only one call
    expect(bridge.editorSetGridSize).toHaveBeenCalledTimes(1)
  })

  // Regression: the C++ side clamps requested gridSize < 4 to 32. Before
  // this fix, the JS cache stored the requested value (e.g. 3) while the
  // runtime stayed at 32, so a later honest request for 3 short-circuited
  // and the runtime never moved. Now JS mirrors the clamp, so the cache
  // always reflects what the runtime actually applied.
  it('syncEditorChrome clamps gridSize < 4 the same way the runtime does', () => {
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, snapToGrid: false, isPlaying: false })
    expect(bridge.editorSetGridSize).toHaveBeenLastCalledWith(32)

    // Requesting 3 — runtime clamps to 32; JS must NOT re-send because
    // the effective value didn't change.
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 3, snapToGrid: false, isPlaying: false })
    expect(bridge.editorSetGridSize).toHaveBeenCalledTimes(1)

    // After resetting cache, a request below the clamp still pushes 32.
    runtimeSync.reset()
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 1, snapToGrid: false, isPlaying: false })
    expect(bridge.editorSetGridSize).toHaveBeenLastCalledWith(32)

    // A valid grid (>= 4) goes through unmodified.
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 48, snapToGrid: false, isPlaying: false })
    expect(bridge.editorSetGridSize).toHaveBeenLastCalledWith(48)
  })

  it('syncEditorChrome pushes snapToGrid to the runtime', () => {
    vi.mocked(bridge.editorSetSnapToGrid).mockClear()
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, snapToGrid: true, isPlaying: false })
    expect(bridge.editorSetSnapToGrid).toHaveBeenCalledWith(true)
    vi.mocked(bridge.editorSetSnapToGrid).mockClear()
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, snapToGrid: true, isPlaying: false })
    expect(bridge.editorSetSnapToGrid).not.toHaveBeenCalled()
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, snapToGrid: false, isPlaying: false })
    expect(bridge.editorSetSnapToGrid).toHaveBeenCalledWith(false)
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

  it('exitPlaySession calls atomic editor_exit_play_mode and latches projection', () => {
    const p = makeProject()
    const invalidator = vi.fn()
    runtimeSync.setAssetCacheInvalidator(invalidator)
    runtimeSync.syncProject(p as never, 'a', '/tmp/x')
    vi.mocked(bridge.editorExitPlayMode).mockClear()
    expect(runtimeSync.exitPlaySession(p as never, 'a', 'function tick(dt) end', {}, '/tmp/x').ok).toBe(true)
    expect(bridge.editorExitPlayMode).toHaveBeenCalledTimes(1)
    expect(invalidator).toHaveBeenCalledTimes(1)
    vi.mocked(bridge.editorLoadProject).mockClear()
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x')).toBe(false)
    expect(bridge.editorLoadProject).not.toHaveBeenCalled()
  })

  it('exitPlaySession preserves engine readiness and restores edit-mode guides', () => {
    const p = makeProject()
    runtimeSync.notifyEngineReady()
    runtimeSync.syncEditorChrome({
      guides: true,
      gridSize: 32,
      snapToGrid: false,
      isPlaying: false,
    })
    runtimeSync.syncEditorChrome({
      guides: true,
      gridSize: 32,
      snapToGrid: false,
      isPlaying: true,
    })
    expect(bridge.editorSetGuidesEnabled).toHaveBeenLastCalledWith(false)

    expect(runtimeSync.exitPlaySession(
      p as never,
      'a',
      'function tick(dt) end',
      {},
      '/tmp/x',
    ).ok).toBe(true)
    expect(runtimeSync.isEngineReady()).toBe(true)

    runtimeSync.syncEditorChrome({
      guides: true,
      gridSize: 32,
      snapToGrid: false,
      isPlaying: false,
    })
    expect(bridge.editorSetGuidesEnabled).toHaveBeenLastCalledWith(true)
  })

  it('enterPlaySession calls atomic editor_enter_play_mode', () => {
    const p = makeProject()
    const lua = 'function tick(dt) end'
    vi.mocked(bridge.editorEnterPlayMode).mockClear()
    expect(runtimeSync.enterPlaySession(p as never, 'a', lua, {}).ok).toBe(true)
    expect(bridge.editorEnterPlayMode).toHaveBeenCalledTimes(1)
  })

  it('enterPlaySession returns failure when atomic play fails', () => {
    vi.mocked(bridge.editorEnterPlayMode).mockReturnValue(2)
    const result = runtimeSync.enterPlaySession(makeProject() as never, 'a', 'x', {})
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    vi.mocked(bridge.editorEnterPlayMode).mockReturnValue(0)
  })

  it('enterPlaySession returns not_ready when runtime is not ready', () => {
    runtimeSync.reset()
    vi.mocked(bridge.isReady).mockReturnValue(false)
    expect(runtimeSync.enterPlaySession(makeProject() as never, 'a', 'x', {}).ok).toBe(false)
    vi.mocked(bridge.isReady).mockReturnValue(true)
  })

  it('exitPlaySession returns false when runtime is not ready', () => {
    vi.mocked(bridge.isReady).mockReturnValue(false)
    expect(runtimeSync.exitPlaySession(makeProject() as never, 'a', 'x').ok).toBe(false)
    expect(bridge.editorExitPlayMode).not.toHaveBeenCalled()
    vi.mocked(bridge.isReady).mockReturnValue(true)
  })

  it('applyMainLua does not cache Lua when editorReloadScript fails', () => {
    runtimeSync.reset()
    vi.mocked(bridge.editorReloadScript).mockReturnValue(2)
    expect(runtimeSync.applyMainLua('function tick(dt) end')).toEqual({
      status: 'failed',
      message: expect.stringContaining('Lua script failed'),
    })

    vi.mocked(bridge.editorReloadScript).mockReturnValue(0)
    expect(runtimeSync.applyMainLua('function tick(dt) end')).toEqual({ status: 'reloaded' })
    vi.mocked(bridge.editorReloadScript).mockClear()
    expect(runtimeSync.applyMainLua('function tick(dt) end')).toEqual({ status: 'unchanged' })
    expect(bridge.editorReloadScript).not.toHaveBeenCalled()
  })

  it('applyMainLua reloads once and syncProject skips duplicate Lua', () => {
    const p = makeProject()
    const luaV1 = 'function tick(dt) end'
    const luaV2 = '-- logic v2'
    runtimeSync.syncProject(p as never, 'a', '/tmp/x')
    vi.mocked(bridge.editorReloadScript).mockClear()

    expect(runtimeSync.applyMainLua(luaV1)).toEqual({ status: 'reloaded' })
    expect(bridge.editorReloadScript).toHaveBeenCalledWith(luaV1)

    vi.mocked(bridge.editorReloadScript).mockClear()
    expect(runtimeSync.applyMainLua(luaV1)).toEqual({ status: 'unchanged' })
    expect(bridge.editorReloadScript).not.toHaveBeenCalled()

    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/x', { mainLua: luaV1 })).toBe(false)
    expect(bridge.editorReloadScript).not.toHaveBeenCalled()

    expect(runtimeSync.applyMainLua(luaV2)).toEqual({ status: 'reloaded' })
    expect(bridge.editorReloadScript).toHaveBeenCalledWith(luaV2)
  })

  it('transitionPreview play sets nextPlaying only on success', () => {
    const p = makeProject()
    const bundle = {
      project: p as never,
      activeSceneId: 'a',
      mainLua: 'function tick(dt) end',
      dialogs: {},
    }
    vi.mocked(bridge.editorEnterPlayMode).mockReturnValue(2)
    const fail = runtimeSync.transitionPreview('play', bundle)
    expect(fail.ok).toBe(false)
    expect(fail.nextPlaying).toBe(false)

    vi.mocked(bridge.editorEnterPlayMode).mockReturnValue(0)
    const ok = runtimeSync.transitionPreview('play', bundle)
    expect(ok.ok).toBe(true)
    expect(ok.nextPlaying).toBe(true)
  })

  it('transitionPreview stop keeps nextPlaying true on failure', () => {
    const p = makeProject()
    const bundle = {
      project: p as never,
      activeSceneId: 'a',
      mainLua: 'function tick(dt) end',
      dialogs: {},
    }
    vi.mocked(bridge.editorExitPlayMode).mockReturnValue(1)
    const fail = runtimeSync.transitionPreview('stop', bundle)
    expect(fail.ok).toBe(false)
    expect(fail.nextPlaying).toBe(true)

    vi.mocked(bridge.editorExitPlayMode).mockReturnValue(0)
    const ok = runtimeSync.transitionPreview('stop', bundle)
    expect(ok.ok).toBe(true)
    expect(ok.nextPlaying).toBe(false)
  })

  it('isTransitioning is true inside exitPlaySession', () => {
    const p = makeProject()
    let inside = false
    vi.mocked(bridge.editorExitPlayMode).mockImplementation(() => {
      inside = runtimeSync.isTransitioning()
      return 0
    })
    runtimeSync.exitPlaySession(p as never, 'a', 'function tick(dt) end', {}, '/tmp/x')
    expect(inside).toBe(true)
    expect(runtimeSync.isTransitioning()).toBe(false)
  })

  it('applyMainLua reports not_ready when WASM is not ready', () => {
    runtimeSync.reset()
    vi.mocked(bridge.isReady).mockReturnValue(false)
    expect(runtimeSync.applyMainLua('function tick(dt) end')).toEqual({
      status: 'not_ready',
      message: 'WASM runtime is not ready yet.',
    })
    vi.mocked(bridge.isReady).mockReturnValue(true)
  })

  it('notifyEngineReady is edge-triggered; late subscribers still get state', () => {
    const cb = vi.fn()
    runtimeSync.onEngineReadyChange(cb)
    expect(runtimeSync.isEngineReady()).toBe(false)
    expect(cb).toHaveBeenCalledWith(false)
    runtimeSync.notifyEngineReady()
    expect(runtimeSync.isEngineReady()).toBe(true)
    expect(cb).toHaveBeenCalledWith(true)
    // Repeat is a no-op: listeners are NOT re-fired, so a repeated bridge-init
    // signal cannot re-drive project sync (the boot render-loop cause).
    runtimeSync.notifyEngineReady()
    expect(cb).toHaveBeenCalledTimes(2) // false + true only
    // A listener subscribing after readiness still gets the current value
    // immediately — the StrictMode-resubscribe path the edge-trigger preserves.
    const late = vi.fn()
    runtimeSync.onEngineReadyChange(late)
    expect(late).toHaveBeenCalledWith(true)
  })

  it('notifyEngineReady invalidates chrome cache so grid/guides resync', () => {
    vi.mocked(bridge.isReady).mockReturnValue(true)
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, snapToGrid: false, isPlaying: false })
    expect(bridge.editorSetGuidesEnabled).toHaveBeenCalledTimes(1)
    runtimeSync.notifyEngineReady()
    runtimeSync.syncEditorChrome({ guides: true, gridSize: 32, snapToGrid: false, isPlaying: false })
    expect(bridge.editorSetGuidesEnabled).toHaveBeenCalledTimes(2)
  })

  it('notifyBootProjectSynced fires when projection latches via syncProject', () => {
    const cb = vi.fn()
    runtimeSync.onBootProjectSyncedChange(cb)
    expect(runtimeSync.isBootProjectSynced()).toBe(false)
    const p = makeProject()
    runtimeSync.syncProject(p as never, 'a', '/tmp/x', { mainLua: 'function tick(dt) end' })
    expect(runtimeSync.hasProjectProjectionLatched()).toBe(true)
    expect(runtimeSync.isBootProjectSynced()).toBe(true)
    expect(cb).toHaveBeenLastCalledWith(true)
  })

  it('reset preserves engine readiness when WASM stays loaded (project open)', () => {
    runtimeSync.notifyEngineReady()
    runtimeSync.notifyBootProjectSynced()
    const engineCb = vi.fn()
    const syncCb = vi.fn()
    runtimeSync.onEngineReadyChange(engineCb)
    runtimeSync.onBootProjectSyncedChange(syncCb)
    vi.mocked(bridge.isReady).mockReturnValue(true)
    runtimeSync.reset()
    expect(runtimeSync.isEngineReady()).toBe(true)
    expect(runtimeSync.isBootProjectSynced()).toBe(false)
    expect(engineCb).not.toHaveBeenCalledWith(false)
    expect(syncCb).toHaveBeenLastCalledWith(false)
    vi.mocked(bridge.editorLoadProject).mockClear()
    const p = makeProject()
    expect(runtimeSync.syncProject(p as never, 'a', '/tmp/reopened/project.json')).toBe(true)
    expect(bridge.editorLoadProject).toHaveBeenCalledTimes(1)
  })

  it('reset clears engine readiness when WASM is not loaded', () => {
    runtimeSync.notifyEngineReady()
    const engineCb = vi.fn()
    runtimeSync.onEngineReadyChange(engineCb)
    vi.mocked(bridge.isReady).mockReturnValue(false)
    runtimeSync.reset()
    expect(runtimeSync.isEngineReady()).toBe(false)
    expect(engineCb).toHaveBeenLastCalledWith(false)
  })
})
