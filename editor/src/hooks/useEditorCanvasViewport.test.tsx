/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createRef } from 'react'
import type { EditorTool } from '../utils/runtime-sync-service'

const editorCenterWorldPointMock = vi.fn()
const syncEditorZoomFromWasmMock = vi.fn()

vi.mock('../utils/editor-viewport-intents', () => ({
  editorCenterWorldPoint: (...args: unknown[]) => editorCenterWorldPointMock(...args),
  syncEditorZoomFromWasm: (...args: unknown[]) => syncEditorZoomFromWasmMock(...args),
}))

import { useEditorCanvasViewport } from './useEditorCanvasViewport'

describe('useEditorCanvasViewport', () => {
  beforeEach(() => {
    editorCenterWorldPointMock.mockReset()
    syncEditorZoomFromWasmMock.mockReset()
  })

  it('does not recenter the camera when selection would have changed', () => {
    const viewportRef = createRef<HTMLDivElement>()
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true })
    viewportRef.current = el

    const dispatch = vi.fn()

    const { rerender } = renderHook(
      ({ activeTool }: { activeTool: EditorTool }) =>
        useEditorCanvasViewport({
          viewportRef,
          zoom: 1,
          dispatch,
          isPlaying: false,
          activeTool,
        }),
      { initialProps: { activeTool: 'select' as EditorTool } },
    )

    expect(editorCenterWorldPointMock).not.toHaveBeenCalled()

    rerender({ activeTool: 'pan' })
    expect(editorCenterWorldPointMock).not.toHaveBeenCalled()
  })
})
