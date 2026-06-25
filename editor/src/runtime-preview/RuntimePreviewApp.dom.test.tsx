// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlankProject } from '../utils/project-factory'
import {
  RUNTIME_PREVIEW_CLOSED_EVENT,
  RUNTIME_PREVIEW_START_EVENT,
} from '../utils/runtime-preview-window'
import { runtimeSync, type PreviewTransitionBundle } from '../utils/runtime-sync-service'
import RuntimePreviewApp from './RuntimePreviewApp'

const listeners = new Map<string, (event: { payload: unknown }) => void>()
const emitToMock = vi.fn(async (..._args: unknown[]) => undefined)
const invokeTauriMock = vi.fn(async (..._args: unknown[]) => undefined)
const destroyWindowMock = vi.fn(async () => undefined)
let closeRequestedHandler: ((event: { preventDefault: () => void }) => Promise<void>) | null = null
const loadSceneMock = vi.fn(async (..._args: unknown[]) => ({ ok: true, loaded: [], failed: [] }))
const clearRegisteredMock = vi.fn()
const setTextureCacheEvictedCallbackMock = vi.fn()
const loadWasmRuntimeMock = vi.fn(async (_canvas: HTMLCanvasElement, _src: string, callbacks: {
  onReady: () => void
  onConsoleLine: (line: string, level: string) => void
}) => {
  callbacks.onReady()
  callbacks.onConsoleLine('[EditorAPI] Bridge initialised', 'info')
  return {}
})

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
}))

vi.mock('@tauri-apps/api/event', () => ({
  emitTo: (...args: unknown[]) => emitToMock(...args),
  listen: async (event: string, handler: (event: { payload: unknown }) => void) => {
    listeners.set(event, handler)
    return () => listeners.delete(event)
  },
}))

vi.mock('../utils/tauri-invoke', () => ({
  invokeTauri: (...args: unknown[]) => invokeTauriMock(...args),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    destroy: () => destroyWindowMock(),
    onCloseRequested: async (handler: (event: { preventDefault: () => void }) => Promise<void>) => {
      closeRequestedHandler = handler
      return () => {
        closeRequestedHandler = null
      }
    },
  }),
}))

vi.mock('../utils/asset-orchestrator', () => ({
  assetOrchestrator: {
    clearRegistered: () => clearRegisteredMock(),
    loadScene: (...args: unknown[]) => loadSceneMock(...args),
  },
}))

vi.mock('../utils/runtime-canvas', () => ({
  getRuntimeCanvas: () => {
    const existing = document.getElementById('runtime-canvas')
    if (existing instanceof HTMLCanvasElement) return existing
    const canvas = document.createElement('canvas')
    canvas.id = 'runtime-canvas'
    return canvas
  },
}))

vi.mock('../utils/wasm-bridge', () => ({
  isReady: () => true,
  loadWasmRuntime: (...args: [HTMLCanvasElement, string, never]) => loadWasmRuntimeMock(...args),
  setTextureCacheEvictedCallback: (fn: unknown) => setTextureCacheEvictedCallbackMock(fn),
}))

function makeBundle(): PreviewTransitionBundle {
  const project = createBlankProject('Runtime Route Test')
  return {
    project,
    activeSceneId: project.activeSceneId,
    mainLua: 'function tick(dt) end',
    dialogs: {},
    projectPath: 'C:/Project/project.json',
  }
}

function dispatchStart(bundle: PreviewTransitionBundle): void {
  listeners.get(RUNTIME_PREVIEW_START_EVENT)?.({ payload: bundle })
}

describe('RuntimePreviewApp', () => {
  beforeEach(() => {
    listeners.clear()
    closeRequestedHandler = null
    emitToMock.mockClear()
    destroyWindowMock.mockClear()
    invokeTauriMock.mockClear()
    loadSceneMock.mockClear()
    clearRegisteredMock.mockClear()
    setTextureCacheEvictedCallbackMock.mockClear()
    loadWasmRuntimeMock.mockClear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('boots safely while waiting for a late bundle', async () => {
    render(<RuntimePreviewApp />)

    await waitFor(() => expect(loadWasmRuntimeMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('Waiting for preview...')).toBeTruthy())
    expect(loadSceneMock).not.toHaveBeenCalled()
  })

  it('keeps the runtime canvas aspect-correct inside resized preview windows', async () => {
    vi.spyOn(runtimeSync, 'transitionPreview').mockReturnValue({
      ok: true,
      code: 0,
      nextPlaying: true,
    })
    const bundle = makeBundle()

    render(<RuntimePreviewApp />)

    await waitFor(() => expect(loadWasmRuntimeMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(listeners.has(RUNTIME_PREVIEW_START_EVENT)).toBe(true))
    dispatchStart(bundle)
    await waitFor(() => expect(loadSceneMock).toHaveBeenCalled())
    const canvas = document.getElementById('runtime-canvas') as HTMLCanvasElement | null
    expect(canvas?.style.width).toBe('1024px')
    expect(canvas?.style.height).toBe('640px')
    expect(canvas?.style.transform).toBe('translate(-50%, -50%)')
    expect(canvas?.style.imageRendering).toBe('pixelated')
  })

  it('toggles fullscreen with F11 in the runtime preview window', async () => {
    render(<RuntimePreviewApp />)

    await waitFor(() => expect(loadWasmRuntimeMock).toHaveBeenCalledTimes(1))
    const event = new KeyboardEvent('keydown', { key: 'F11', cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(invokeTauriMock).toHaveBeenCalledWith(
      'toggle_runtime_preview_fullscreen',
    ))
  })

  it('loads scene assets and enters play after receiving a bundle', async () => {
    const transitionSpy = vi.spyOn(runtimeSync, 'transitionPreview').mockReturnValue({
      ok: true,
      code: 0,
      nextPlaying: true,
    })
    const bundle = makeBundle()

    render(<RuntimePreviewApp />)
    await waitFor(() => expect(listeners.has(RUNTIME_PREVIEW_START_EVENT)).toBe(true))
    dispatchStart(bundle)

    await waitFor(() => expect(loadSceneMock).toHaveBeenCalledWith(
      bundle.project,
      bundle.activeSceneId,
      'C:/Project',
    ))
    await waitFor(() => expect(transitionSpy).toHaveBeenCalledWith('play', bundle))
  })

  it('notifies the editor and destroys the native window when close is requested', async () => {
    const preventDefault = vi.fn()

    render(<RuntimePreviewApp />)
    await waitFor(() => expect(closeRequestedHandler).not.toBeNull())
    await closeRequestedHandler?.({ preventDefault })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(emitToMock).toHaveBeenCalledWith('main', RUNTIME_PREVIEW_CLOSED_EVENT)
    expect(destroyWindowMock).toHaveBeenCalledTimes(1)
  })
})
