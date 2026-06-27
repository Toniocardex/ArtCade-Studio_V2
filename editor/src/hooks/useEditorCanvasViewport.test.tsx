/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createRef, type WheelEvent } from 'react'
import type { EditorTool } from '../utils/runtime-sync-service'

const editorCenterWorldPointMock = vi.fn()
const syncEditorZoomFromWasmMock = vi.fn()
const editorSetPointerPresentationRevisionMock = vi.fn()
const editorSetPointerSceneRevisionMock = vi.fn()
const editorZoomAtMock = vi.fn()
const captureSurfacePointerEventMock = vi.fn()

vi.mock('../utils/editor-viewport-intents', () => ({
  editorCenterWorldPoint: (...args: unknown[]) => editorCenterWorldPointMock(...args),
  syncEditorZoomFromWasm: (...args: unknown[]) => syncEditorZoomFromWasmMock(...args),
}))

vi.mock('../utils/wasm-bridge', () => ({
  editorBeginPan: vi.fn(),
  editorUpdatePan: vi.fn(),
  editorEndPan: vi.fn(),
  editorZoomAt: (...args: unknown[]) => editorZoomAtMock(...args),
  editorSetPointerPresentationRevision: (...args: unknown[]) =>
    editorSetPointerPresentationRevisionMock(...args),
  editorSetPointerSceneRevision: (...args: unknown[]) =>
    editorSetPointerSceneRevisionMock(...args),
}))

vi.mock('../utils/surface-pointer-event', () => ({
  captureSurfacePointerEvent: (...args: unknown[]) => captureSurfacePointerEventMock(...args),
}))

import { useEditorCanvasViewport } from './useEditorCanvasViewport'

function mountViewport(activeTool: EditorTool = 'select') {
  const viewportRef = createRef<HTMLDivElement>()
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true })
  el.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  viewportRef.current = el
  const dispatch = vi.fn()
  const hook = renderHook(() =>
    useEditorCanvasViewport({
      viewportRef,
      zoom: 1,
      dispatch,
      isPlaying: false,
      activeTool,
    }),
  )
  return { hook, el, dispatch }
}

describe('useEditorCanvasViewport', () => {
  beforeEach(() => {
    editorCenterWorldPointMock.mockReset()
    syncEditorZoomFromWasmMock.mockReset()
    editorSetPointerPresentationRevisionMock.mockReset()
    editorSetPointerSceneRevisionMock.mockReset()
    editorZoomAtMock.mockReset()
    captureSurfacePointerEventMock.mockReset()
    captureSurfacePointerEventMock.mockReturnValue({
      positionCss: { x: 120, y: 80 },
      presentationRevision: 77n,
      sceneRevision: 5n,
    })
  })

  it('does not recenter the camera when selection would have changed', () => {
    const { hook } = mountViewport('select')
    expect(editorCenterWorldPointMock).not.toHaveBeenCalled()
    hook.rerender()
    expect(editorCenterWorldPointMock).not.toHaveBeenCalled()
  })

  it('tags wheel zoom with the presentation revision captured at event time', () => {
    const { hook, el } = mountViewport('select')
    act(() => {
      hook.result.current.onWheel({
        ctrlKey: true,
        clientX: 120,
        clientY: 80,
        deltaY: -1,
        currentTarget: el,
        preventDefault: () => {},
      } as unknown as WheelEvent<HTMLDivElement>)
    })
    expect(captureSurfacePointerEventMock).toHaveBeenCalled()
    expect(editorSetPointerPresentationRevisionMock).toHaveBeenCalledWith(77n)
    expect(editorSetPointerSceneRevisionMock).toHaveBeenCalledWith(5n)
    expect(editorZoomAtMock).toHaveBeenCalledWith(120, 80, expect.any(Number))
  })
})
