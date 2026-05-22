import { describe, it, expect, vi } from 'vitest'

;(globalThis as unknown as { window: Record<string, unknown> }).window =
  (globalThis as unknown as { window?: Record<string, unknown> }).window ?? {}

vi.mock('../../utils/wasm-bridge', () => ({
  isReady: vi.fn(() => false),
  loadWasmRuntime: vi.fn(),
  editorRegisterImage: vi.fn(),
}))

vi.mock('../../utils/runtime-sync-service', () => ({
  runtimeSync: {
    syncProject: vi.fn(),
    syncPlayMode: vi.fn(),
    syncSelection: vi.fn(),
    syncEditorTool: vi.fn(),
    syncEditorChrome: vi.fn(),
  },
}))

const { shouldSyncProjectToRuntime } = await import('./runtime-hooks')

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
