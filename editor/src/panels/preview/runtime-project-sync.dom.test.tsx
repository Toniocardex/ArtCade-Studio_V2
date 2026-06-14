/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let wasmReady = false
let engineReady = false
const syncProject = vi.fn()

vi.mock('../../utils/wasm-bridge', () => ({
  isReady: () => wasmReady,
  loadWasmRuntime: vi.fn(),
  editorRegisterImage: vi.fn(),
}))

vi.mock('../../utils/runtime-sync-service', () => ({
  runtimeSync: {
    isEngineReady: () => engineReady,
    isTransitioning: () => false,
    onReadyChange: () => () => undefined,
    onEngineReadyChange: () => () => undefined,
    syncProject,
  },
}))

vi.mock('../../utils/preview-restore', () => ({
  getPreviewLuaSyncKey: () => 'boot-project',
  logLogicBoardCompileFailure: vi.fn(),
  resolvePreviewMainLuaWithStatus: () => ({
    lua: 'function tick(dt) end',
    compileError: null,
  }),
}))

vi.mock('../../utils/wasm-ui-scheduler', () => ({
  scheduleWasmUiUpdate: vi.fn(),
  scheduleWasmUiUpdateWhen: vi.fn(),
}))

const { useRuntimeProjectSync } = await import('./runtime-hooks')

const project = {
  projectName: 'Boot project',
  version: '1',
  activeSceneId: 'scene_main',
  mainScriptPath: 'main.lua',
  targetFPS: 60,
  entities: {},
  scenes: {},
}

function options() {
  return {
    project: project as never,
    projectPath: null,
    openScripts: [],
    dialogs: {},
    selectionSceneId: 'scene_main',
    wasmReady,
    engineReady,
    isPlaying: false,
    dispatch: vi.fn(),
    makeLogEntry: () => ({ id: 1, time: '', message: '', level: 'info' as const }),
  }
}

beforeEach(() => {
  wasmReady = false
  engineReady = false
  syncProject.mockClear()
})

describe('useRuntimeProjectSync boot readiness', () => {
  it('syncs when React observes readiness even if bridge notifications were missed', () => {
    let currentOptions = options()
    const { rerender } = renderHook(() => useRuntimeProjectSync(currentOptions))
    expect(syncProject).not.toHaveBeenCalled()

    wasmReady = true
    engineReady = true
    currentOptions = { ...currentOptions, wasmReady, engineReady }
    rerender()

    expect(syncProject).toHaveBeenCalledTimes(1)

    rerender()
    expect(syncProject).toHaveBeenCalledTimes(1)
  })
})
