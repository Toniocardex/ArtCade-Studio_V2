import { describe, it, expect, vi } from 'vitest'
import { isReady, isEditorEngineWired } from '../../utils/wasm-bridge'

;(globalThis as unknown as { window: Record<string, unknown> }).window =
  (globalThis as unknown as { window?: Record<string, unknown> }).window ?? {}

vi.mock('../../utils/wasm-bridge', () => ({
  isReady: vi.fn(() => false),
  isEditorEngineWired: vi.fn(() => false),
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
    isBootProjectSynced: vi.fn(() => false),
    isEngineReady: vi.fn(() => false),
    syncPlayMode: vi.fn(),
    syncSelection: vi.fn(),
    syncEditorTool: vi.fn(),
    syncEditorChrome: vi.fn(),
    notifyReadyChanged,
    notifyEngineReady,
    syncPresentationSnapshotNow: vi.fn(),
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

const queueTransformPreview = vi.fn()
vi.mock('../../utils/transform-preview-store', () => ({
  queueTransformPreview,
  clearTransformPreview: vi.fn(),
  publishTransformPreview: vi.fn(),
  useTransformPreview: vi.fn(() => null),
}))

const { shouldSyncProjectToRuntime, performRuntimeProjectSync, buildRuntimeCallbacks } =
  await import('./runtime-hooks')

const emptyBootSyncRef = {
  current: {
    project: null,
    projectPath: null,
    openScripts: [],
    dialogs: {},
    selectionSceneId: null,
    isPlaying: false,
  },
}

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
  it('calls runtimeSync.syncProject with compiled main Lua', async () => {
    syncProjectMock.mockClear()
    await performRuntimeProjectSync({
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

  it('skips sync while runtime transition is in progress', async () => {
    syncProjectMock.mockClear()
    isTransitioningMock.mockReturnValue(true)
    await performRuntimeProjectSync({
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
  it('completes boot handshake on onReady when WASM is live', () => {
    notifyReadyChanged.mockClear()
    notifyEngineReady.mockClear()
    vi.mocked(isReady).mockReturnValue(true)
    vi.mocked(isEditorEngineWired).mockReturnValue(true)
    const dispatch = vi.fn()
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform: vi.fn(),
      sceneIdRef: { current: 'a' },
      syncRuntimeUiFlags: vi.fn(),
      makeLogEntry: (message, level) => ({ id: 1, time: '', message, level }),
      bootSyncRef: emptyBootSyncRef,
    })

    callbacks.onReady?.()
    expect(notifyReadyChanged).toHaveBeenCalledTimes(1)
    // Boot handshake completes on onReady once WASM ccalls are live.
    expect(notifyEngineReady).toHaveBeenCalledTimes(1)
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
      bootSyncRef: emptyBootSyncRef,
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
      bootSyncRef: emptyBootSyncRef,
    })

    callbacks.onEntityDuplicateRequested(7, 320, 192)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'INSTANCE_DUPLICATE',
      instanceId: 7,
      sceneId: 'scene_main',
      position: { x: 320, y: 192 },
    })
  })

  it('queues transform preview from onEntityTransformPreview', () => {
    queueTransformPreview.mockClear()
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch: vi.fn(),
      handleRuntimeTransform: vi.fn(),
      sceneIdRef: { current: 'a' },
      syncRuntimeUiFlags: vi.fn(),
      makeLogEntry: (message, level) => ({ id: 1, time: '', message, level }),
      bootSyncRef: emptyBootSyncRef,
    })

    callbacks.onEntityTransformPreview(3, 64, 128, 0, 2, 2)
    expect(queueTransformPreview).toHaveBeenCalledWith({
      entityId: 3,
      x: 64,
      y: 128,
      rotation: 0,
      scaleX: 2,
      scaleY: 2,
    })
  })

  it('marks engine ready when EditorAPI bridge initialises and WASM is live', () => {
    notifyEngineReady.mockClear()
    vi.mocked(isReady).mockReturnValue(true)
    vi.mocked(isEditorEngineWired).mockReturnValue(true)
    const dispatch = vi.fn()
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform: vi.fn(),
      sceneIdRef: { current: 'a' },
      syncRuntimeUiFlags: vi.fn(),
      makeLogEntry: (message, level) => ({ id: 1, time: '', message, level }),
      bootSyncRef: emptyBootSyncRef,
    })

    callbacks.onConsoleLine?.('[EditorAPI] Bridge initialised', 'info')
    expect(notifyEngineReady).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOG' }),
    )
  })

  it('does not mark engine ready on Mode: EDIT alone', () => {
    notifyEngineReady.mockClear()
    const dispatch = vi.fn()
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform: vi.fn(),
      sceneIdRef: { current: 'a' },
      syncRuntimeUiFlags: vi.fn(),
      makeLogEntry: (message, level) => ({ id: 1, time: '', message, level }),
      bootSyncRef: emptyBootSyncRef,
    })

    callbacks.onConsoleLine?.('[EditorAPI] Mode: EDIT', 'info')
    expect(notifyEngineReady).not.toHaveBeenCalled()
  })
})
