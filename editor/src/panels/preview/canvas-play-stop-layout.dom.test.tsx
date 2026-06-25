/**
 * @vitest-environment happy-dom
 */
import { useEffect, useRef } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorProvider, useEditorDispatch } from '../../store/editor-store'
import { EditorLayoutTierProvider, useLayoutTier } from '../../contexts/editor-layout-tier-context'
import { EditorLayoutProvider } from '../../contexts/editor-layout-context'
import { InspectorDrawerProvider } from '../../contexts/inspector-drawer-context'
import { ExplorerDrawerProvider } from '../../contexts/explorer-drawer-context'
import { createBlankProject } from '../../utils/project'
import { starterInnkeeperScript } from '../../utils/dialog/dialog-file-api'
import { resetBootSessionMarker } from '../../utils/boot-session'
import type { Action } from '../../store/editor-store'
import type { LayoutTier } from '../../utils/editor-layout-tier'

const { loadWasmRuntime, wasmReady } = vi.hoisted(() => ({
  loadWasmRuntime: vi.fn(),
  wasmReady: { value: false },
}))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
}))

vi.mock('../../utils/wasm-bridge', () => ({
  isReady: () => wasmReady.value,
  loadWasmRuntime: (...args: unknown[]) => loadWasmRuntime(...args),
  warmWasmBinary: vi.fn(),
  editorSetEditCamera: vi.fn(),
  editorSyncPlaySurface: vi.fn(),
  editorSetActiveTileLayer: vi.fn(),
  editorSetTool: vi.fn(),
  editorSetGuidesEnabled: vi.fn(),
  editorSetGridSize: vi.fn(),
  editorSetSnapToGrid: vi.fn(),
  editorSelectEntity: vi.fn(),
  editorSelectEntities: vi.fn(),
  editorDeselect: vi.fn(),
  editorRegisterImage: vi.fn(),
  setTextureCacheEvictedCallback: vi.fn(),
  editorPaintTile: vi.fn(),
  editorSyncTilemapData: vi.fn(),
}))

vi.mock('../../utils/asset-watcher', () => ({
  watchProjectAssets: vi.fn(() => Promise.resolve(() => undefined)),
}))

const PreviewPanel = (await import('../PreviewPanel')).default

type TierCase = Readonly<{
  name: LayoutTier
  width: number
  height: number
  scrollWidth: number
  scrollHeight: number
}>

let dispatchRef: ((action: Action) => void) | null = null
let tierRef: LayoutTier | null = null
let cleanupDomMocks: (() => void) | null = null

class ImmediateResizeObserver {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element): void {
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }

  disconnect(): void {
    // No-op in this deterministic test observer.
  }
}

function installDomMetrics(tierCase: TierCase): void {
  const winWidth = tierCase.width
  const winHeight = tierCase.height

  Object.defineProperty(globalThis, 'innerWidth', { value: winWidth, writable: true, configurable: true })
  Object.defineProperty(globalThis, 'innerHeight', { value: winHeight, writable: true, configurable: true })

  const resizeObserverBefore = globalThis.ResizeObserver
  globalThis.ResizeObserver = ImmediateResizeObserver as unknown as typeof ResizeObserver

  const widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function clientWidth(
    this: HTMLElement,
  ) {
    if (this.classList.contains('canvas-scrollarea')) return tierCase.scrollWidth
    if (this.classList.contains('runtime-play-stage')) return tierCase.scrollWidth
    if (this.dataset.testid === 'workspace') return winWidth
    return 0
  })
  const heightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function clientHeight(
    this: HTMLElement,
  ) {
    if (this.classList.contains('canvas-scrollarea')) return tierCase.scrollHeight
    if (this.classList.contains('runtime-play-stage')) return tierCase.scrollHeight
    if (this.dataset.testid === 'workspace') return winHeight
    return 0
  })
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(
    this: HTMLElement,
  ) {
    if (this.dataset.testid === 'workspace') {
      return {
        x: 0, y: 0, top: 0, left: 0, right: winWidth, bottom: winHeight,
        width: winWidth, height: winHeight,
        toJSON: () => ({}),
      } as DOMRect
    }
    return {
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0,
      width: 0, height: 0,
      toJSON: () => ({}),
    } as DOMRect
  })

  cleanupDomMocks = () => {
    widthSpy.mockRestore()
    heightSpy.mockRestore()
    rectSpy.mockRestore()
    globalThis.ResizeObserver = resizeObserverBefore
  }
}

function BootLoader() {
  const dispatch = useEditorDispatch()
  useEffect(() => {
    dispatchRef = dispatch
    dispatch({
      type: 'LOAD_PROJECT',
      project: createBlankProject('Untitled'),
      path: '',
      dialogs: { innkeeper: starterInnkeeperScript() },
      selectedDialogId: 'innkeeper',
    })
  }, [dispatch])
  return null
}

function TierProbe() {
  tierRef = useLayoutTier()
  return null
}

function Fixture() {
  const workspaceRef = useRef<HTMLDivElement>(null)
  return (
    <EditorProvider>
      <EditorLayoutTierProvider workspaceRef={workspaceRef}>
        <EditorLayoutProvider>
          <ExplorerDrawerProvider>
            <InspectorDrawerProvider>
              <div ref={workspaceRef} data-testid="workspace">
                <BootLoader />
                <TierProbe />
                <PreviewPanel activeTool="select" onSelectTool={() => undefined} />
              </div>
            </InspectorDrawerProvider>
          </ExplorerDrawerProvider>
        </EditorLayoutProvider>
      </EditorLayoutTierProvider>
    </EditorProvider>
  )
}

function sceneFrameMargin(): string {
  const frameSpacer = document.querySelector('.canvas-scene-frame')?.parentElement
  expect(frameSpacer).toBeTruthy()
  return frameSpacer?.style.margin ?? ''
}

describe('PreviewPanel play/stop layout centring', () => {
  beforeEach(() => {
    resetBootSessionMarker()
    wasmReady.value = false
    dispatchRef = null
    tierRef = null
    loadWasmRuntime.mockReset()
    loadWasmRuntime.mockImplementation((_c, _s, callbacks) => {
      wasmReady.value = true
      callbacks?.onReady?.()
      return Promise.resolve()
    })
  })

  afterEach(() => {
    cleanup()
    cleanupDomMocks?.()
    cleanupDomMocks = null
  })

  const cases: TierCase[] = [
    { name: 'full', width: 1680, height: 950, scrollWidth: 1120, scrollHeight: 720 },
    { name: 'compact', width: 1366, height: 768, scrollWidth: 900, scrollHeight: 520 },
    { name: 'minimal', width: 1180, height: 660, scrollWidth: 760, scrollHeight: 440 },
    { name: 'unsupported', width: 980, height: 590, scrollWidth: 640, scrollHeight: 380 },
  ]

  it.each(cases)('keeps the scene centred after browser Play/Stop in $name tier', async (tierCase) => {
    installDomMetrics(tierCase)
    render(<Fixture />)

    await waitFor(() => expect(tierRef).toBe(tierCase.name))
    await waitFor(() => expect(document.querySelector('.canvas-scene-frame')).toBeTruthy())
    const before = sceneFrameMargin()
    expect(before).not.toBe('0px')
    expect(before).not.toBe('')

    act(() => {
      dispatchRef?.({ type: 'SET_PLAYING', playing: true })
    })
    await waitFor(() => expect(document.querySelector('.runtime-play-stage')).toBeTruthy())
    expect(document.querySelector('.canvas-scrollarea')).toBeNull()

    act(() => {
      dispatchRef?.({ type: 'SET_PLAYING', playing: false })
    })
    await waitFor(() => expect(document.querySelector('.canvas-scrollarea')).toBeTruthy())
    await waitFor(() => expect(sceneFrameMargin()).toBe(before))
  })
})
