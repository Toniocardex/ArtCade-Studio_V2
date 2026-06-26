// ---------------------------------------------------------------------------
// useEditorFitZoom — Ctrl+9 fit zoom + resize tracking in fit mode
// ---------------------------------------------------------------------------

import { useCallback, useLayoutEffect, type Dispatch, type RefObject } from 'react'
import { zoomFitRegistry } from '../utils/zoom-fit-registry'
import type { Action } from '../store/editor-store'
import { editorFrameWorld } from '../utils/editor-viewport-intents'

export type UseEditorFitZoomParams = Readonly<{
  viewportRef: RefObject<HTMLDivElement | null>
  dispatch: Dispatch<Action>
  editorZoomMode: 'fit' | 'manual'
  preview: boolean
  sceneWidth: number
  sceneHeight: number
  viewportWidth: number
  viewportHeight: number
}>

/**
 * Registers fit-zoom with the global shortcut registry and re-fits when the
 * viewport resizes while `editorZoomMode === 'fit'`.
 */
export function useEditorFitZoom({
  viewportRef,
  dispatch,
  editorZoomMode,
  preview,
  sceneWidth,
  sceneHeight,
  viewportWidth,
  viewportHeight,
}: UseEditorFitZoomParams): void {
  const fitZoom = useCallback(() => {
    const sceneW = preview ? viewportWidth : sceneWidth
    const sceneH = preview ? viewportHeight : sceneHeight
    editorFrameWorld(0, 0, sceneW, sceneH, dispatch, window.devicePixelRatio || 1)
  }, [dispatch, preview, sceneWidth, sceneHeight, viewportWidth, viewportHeight])

  useLayoutEffect(() => zoomFitRegistry.register(fitZoom), [fitZoom])

  useLayoutEffect(() => {
    if (editorZoomMode !== 'fit') return undefined
    const el = viewportRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => fitZoom())
    ro.observe(el)
    return () => ro.disconnect()
  }, [editorZoomMode, viewportRef, fitZoom])
}
