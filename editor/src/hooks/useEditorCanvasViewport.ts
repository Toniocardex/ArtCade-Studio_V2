// ---------------------------------------------------------------------------
// useEditorCanvasViewport — pan, wheel zoom, frame entity (fixed surface)
// ---------------------------------------------------------------------------

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
} from 'react'
import { EDITOR_ZOOM_WHEEL_FACTOR } from '../constants/editor-viewport'
import type { Action } from '../store/editor-store'
import type { ProjectDoc } from '../types'
import {
  editorBeginPan,
  editorEndPan,
  editorUpdatePan,
  editorZoomAt,
} from '../utils/wasm-bridge'
import {
  editorCenterWorldPoint,
  syncEditorZoomFromWasm,
} from '../utils/editor-viewport-intents'
import type { EditorTool } from '../utils/runtime-sync-service'

export type UseEditorCanvasViewportParams = Readonly<{
  viewportRef: RefObject<HTMLDivElement | null>
  zoom: number
  dispatch: Dispatch<Action>
  selectedEntityId: number | null | undefined
  project: ProjectDoc | null
  isPlaying: boolean
  activeTool: EditorTool
}>

export type EditorCanvasViewportHandlers = Readonly<{
  panActive: boolean
  panCursor: string
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void
}>

function panCursorStyle(isPanning: boolean, tool: EditorTool): string {
  if (isPanning) return 'grabbing'
  if (tool === 'pan') return 'grab'
  return 'default'
}

function viewportLocalPoint(
  el: HTMLDivElement,
  clientX: number,
  clientY: number,
): Readonly<{ x: number; y: number }> {
  const rect = el.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

export function useEditorCanvasViewport({
  viewportRef,
  zoom,
  dispatch,
  selectedEntityId,
  project,
  isPlaying,
  activeTool,
}: UseEditorCanvasViewportParams): EditorCanvasViewportHandlers {
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
  } | null>(null)
  const prevSelectedEntityRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isPlaying) return
    const el = viewportRef.current
    if (!el) return
    requestAnimationFrame(() => el.focus({ preventScroll: true }))
  }, [isPlaying, viewportRef])

  useEffect(() => {
    const entityId = selectedEntityId
    if (entityId == null || !project) {
      prevSelectedEntityRef.current = null
      return
    }
    if (prevSelectedEntityRef.current === entityId) return
    prevSelectedEntityRef.current = entityId
    const def = project.entities[entityId]
    if (!def) return
    const el = viewportRef.current
    if (!el) return
    const dpr = window.devicePixelRatio || 1
    editorCenterWorldPoint(
      def.transform.position,
      el.clientWidth,
      el.clientHeight,
      zoom,
      dpr,
    )
  }, [selectedEntityId, project, viewportRef, zoom])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current
    if (!el) return
    const wantsPan = e.button === 1 || (e.button === 0 && activeTool === 'pan')
    if (!wantsPan) return

    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    const local = viewportLocalPoint(el, e.clientX, e.clientY)
    editorBeginPan(local.x, local.y)
    panStartRef.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
    }
    setIsPanning(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pan = panStartRef.current
    const el = viewportRef.current
    if (!pan || !el) return
    const local = viewportLocalPoint(el, e.clientX, e.clientY)
    editorUpdatePan(local.x, local.y)
  }

  function onPointerUp() {
    const pan = panStartRef.current
    const el = viewportRef.current
    if (!pan || !el) return
    if (el.hasPointerCapture(pan.pointerId)) el.releasePointerCapture(pan.pointerId)
    editorEndPan()
    panStartRef.current = null
    setIsPanning(false)
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey) return
    e.preventDefault()
    const el = viewportRef.current
    if (!el) return

    const local = viewportLocalPoint(el, e.clientX, e.clientY)
    const factor = e.deltaY < 0 ? EDITOR_ZOOM_WHEEL_FACTOR : 1 / EDITOR_ZOOM_WHEEL_FACTOR
    editorZoomAt(local.x, local.y, factor)
    syncEditorZoomFromWasm(dispatch, window.devicePixelRatio || 1)
  }

  const panActive = activeTool === 'pan' || isPanning

  return {
    panActive,
    panCursor: panCursorStyle(isPanning, activeTool),
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
  }
}
