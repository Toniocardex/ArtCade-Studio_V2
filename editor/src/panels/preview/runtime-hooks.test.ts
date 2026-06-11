import { describe, it, expect, vi } from 'vitest'

;(globalThis as unknown as { window: Record<string, unknown> }).window =
  (globalThis as unknown as { window?: Record<string, unknown> }).window ?? {}

vi.mock('../../utils/wasm-bridge', () => ({
  isReady: vi.fn(() => false),
  loadWasmRuntime: vi.fn(),
  editorRegisterImage: vi.fn(),
}))

const syncProjectMock = vi.fn()
const isTransitioningMock = vi.fn(() => false)
const notifyReadyChanged = vi.fn()
const notifyEngineReady = vi.fn()
vi.mock('../../utils/runtime-sync-service', () => ({
  runtimeSync: {
    syncProject: syncProjectMock,
    isTransitioning: isTransitioningMock,
    syncPlayMode: vi.fn(),
    syncSelection: vi.fn(),
    syncEditorTool: vi.fn(),
    syncEditorChrome: vi.fn(),
    notifyReadyChanged,
    notifyEngineReady,
  },
}))

const resolvePreviewMainLuaMock = vi.fn(() => ({ lua: 'function tick(dt) end', compileError: null }))
vi.mock('../../utils/preview-restore', () => ({
  resolvePreviewMainLuaWithStatus: resolvePreviewMainLuaMock,
  logLogicBoardCompileFailure: vi.fn(),
  getPreviewLuaSyncKey: vi.fn(() => 'sync-key'),
}))

const scheduleWasmUiUpdate = vi.fn((fn: () => void) => fn())
const scheduleWasmUiUpdateWhen = vi.fn((_: () => boolean, fn: () => void) => fn())
vi.mock('../../utils/wasm-ui-scheduler', () => ({
  scheduleWasmUiUpdate,
  scheduleWasmUiUpdateWhen,
}))

const { shouldSyncProjectToRuntime, performRuntimeProjectSync, buildRuntimeCallbacks } =
  await import('./runtime-hooks')

function makeProject() {
  return {
    projectName: 'T',
    version: '1',
    activeSceneId: 'a',
    mainScriptPath: 'm.lua',
    targetFPS: 60,
    entities: {},
    scenes: {},
  }
}

describe('shouldSyncProjectToRuntime', () => {
  it('returns false when isPlaying', () => {
    expect(shouldSyncProjectToRuntime({
      wasmReady: true,
      engineReady: true,
      project: makeProject() as never,
      isPlaying: true,
    })).toBe(false)
  })

  it('returns true when ready and not playing', () => {
    expect(shouldSyncProjectToRuntime({
      wasmReady: true,
      engineReady: true,
      project: makeProject() as never,
      isPlaying: false,
    })).toBe(true)
  })

  it('returns false when wasm is not ready', () => {
    expect(shouldSyncProjectToRuntime({
      wasmReady: false,
      engineReady: true,
      project: makeProject() as never,
      isPlaying: false,
    })).toBe(false)
  })
})

describe('performRuntimeProjectSync', () => {
  it('calls runtimeSync.syncProject with compiled main Lua', () => {
    syncProjectMock.mockClear()
    performRuntimeProjectSync({
      project: makeProject() as never,
      projectPath: '/tmp/p/project.json',
      openScripts: [],
      dialogs: {},
      selectionSceneId: 'a',
      wasmReady: true,
      engineReady: true,
      isPlaying: false,
      dispatch: vi.fn(),
      makeLogEntry: () => ({ id: 0, time: '', message: '', level: 'info' }),
    })
    expect(syncProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: 'T' }),
      'a',
      '/tmp/p/project.json',
      expect.objectContaining({ mainLua: 'function tick(dt) end' }),
    )
  })

  it('skips sync while runtime transition is in progress', () => {
    syncProjectMock.mockClear()
    isTransitioningMock.mockReturnValue(true)
    performRuntimeProjectSync({
      project: makeProject() as never,
      projectPath: null,
      openScripts: [],
      dialogs: {},
      selectionSceneId: 'a',
      wasmReady: true,
      engineReady: true,
      isPlaying: false,
      dispatch: vi.fn(),
      makeLogEntry: () => ({ id: 0, time: '', message: '', level: 'info' }),
    })
    expect(syncProjectMock).not.toHaveBeenCalled()
    isTransitioningMock.mockReturnValue(false)
  })
})

describe('buildRuntimeCallbacks', () => {
  it('notifies runtime readiness on onReady', () => {
    notifyReadyChanged.mockClear()
    const dispatch = vi.fn()
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform: vi.fn(),
      sceneIdRef: { current: 'a' },
      syncRuntimeUiFlags: vi.fn(),
      makeLogEntry: (message, level) => ({ id: 1, time: '', message, level }),
    })

    callbacks.onReady?.()
    expect(notifyReadyChanged).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOG', entry: expect.objectContaining({ level: 'info' }) }),
    )
  })

  it('dispatches SELECT_ENTITY from onEntitySelected', () => {
    const dispatch = vi.fn()
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform: vi.fn(),
      sceneIdRef: { current: 'a' },
      syncRuntimeUiFlags: vi.fn(),
      makeLogEntry: (message, level) => ({ id: 1, time: '', message, level }),
    })

    callbacks.onEntitySelected?.(42)
    expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_ENTITY', entityId: 42 })
  })

  it('dispatches an explicitly positioned duplicate request from the canvas bridge', () => {
    const dispatch = vi.fn()
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform: vi.fn(),
      sceneIdRef: { current: 'scene_main' },
      syncRuntimeUiFlags: vi.fn(),
      makeLogEntry: (message, level) => ({ id: 1, time: '', message, level }),
    })

    callbacks.onEntityDuplicateRequested(7, 320, 192)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'INSTANCE_DUPLICATE',
      instanceId: 7,
      sceneId: 'scene_main',
      position: { x: 320, y: 192 },
    })
  })

  it('marks engine ready when EditorAPI bridge initialises', () => {
    notifyEngineReady.mockClear()
    const dispatch = vi.fn()
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform: vi.fn(),
      sceneIdRef: { current: 'a' },
      syncRuntimeUiFlags: vi.fn(),
      makeLogEntry: (message, level) => ({ id: 1, time: '', message, level }),
    })

    callbacks.onConsoleLine?.('[EditorAPI] Bridge initialised', 'info')
    expect(notifyEngineReady).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOG' }),
    )
  })
})
