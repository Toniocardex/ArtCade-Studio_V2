// ---------------------------------------------------------------------------
// useEditorFitZoom — Ctrl+9 fit zoom + resize tracking in fit mode
// ---------------------------------------------------------------------------

import { useCallback, useLayoutEffect, type Dispatch, type RefObject } from 'react'
import { computeFitZoom } from '../utils/editor-zoom'
import { zoomFitRegistry } from '../utils/zoom-fit-registry'
import type { Action } from '../store/editor-store'

export type UseEditorFitZoomParams = Readonly<{
  scrollRef: RefObject<HTMLDivElement | null>
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
 * scroll viewport resizes while `editorZoomMode === 'fit'`.
 */
export function useEditorFitZoom({
  scrollRef,
  dispatch,
  editorZoomMode,
  preview,
  sceneWidth,
  sceneHeight,
  viewportWidth,
  viewportHeight,
}: UseEditorFitZoomParams): void {
  const fitZoom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const sceneW = preview ? viewportWidth : sceneWidth
    const sceneH = preview ? viewportHeight : sceneHeight
    dispatch({
      type: 'EDITOR_SET_FIT_ZOOM',
      zoom: computeFitZoom(el.clientWidth, el.clientHeight, sceneW, sceneH),
    })
  }, [
    scrollRef,
    dispatch,
    preview,
    sceneWidth,
    sceneHeight,
    viewportWidth,
    viewportHeight,
  ])

  useLayoutEffect(() => zoomFitRegistry.register(fitZoom), [fitZoom])

  useLayoutEffect(() => {
    if (editorZoomMode !== 'fit') return
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => fitZoom())
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [editorZoomMode, fitZoom, scrollRef])
}
