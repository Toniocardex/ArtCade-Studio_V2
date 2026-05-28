import { describe, it, expect, vi } from 'vitest'

;(globalThis as unknown as { window: Record<string, unknown> }).window =
  (globalThis as unknown as { window?: Record<string, unknown> }).window ?? {}

vi.mock('../../utils/wasm-bridge', () => ({
  isReady: vi.fn(() => false),
  loadWasmRuntime: vi.fn(),
  editorRegisterImage: vi.fn(),
}))

const syncProjectMock = vi.fn()
vi.mock('../../utils/runtime-sync-service', () => ({
  runtimeSync: {
    syncProject: syncProjectMock,
    syncPlayMode: vi.fn(),
    syncSelection: vi.fn(),
    syncEditorTool: vi.fn(),
    syncEditorChrome: vi.fn(),
  },
}))

vi.mock('../../utils/preview-restore', () => ({
  resolvePreviewMainLuaWithStatus: vi.fn(() => ({ lua: 'function tick(dt) end', compileError: null })),
  logLogicBoardCompileFailure: vi.fn(),
}))

const { shouldSyncProjectToRuntime, performRuntimeProjectSync } = await import('./runtime-hooks')

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
})
