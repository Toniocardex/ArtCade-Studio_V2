// ---------------------------------------------------------------------------
// useEditorCanvasViewport — pan, wheel zoom, scroll-to-entity, world centre
// ---------------------------------------------------------------------------
//
// Extracted from PreviewPanel so the panel stays an orchestrator (runtime
// hooks + JSX) without owning every scroll-container interaction.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
} from 'react'
import { EDITOR_ZOOM_WHEEL_FACTOR } from '../constants/editor-viewport'
import type { Action } from '../store/editor-store'
import type { ProjectDoc } from '../types'
import {
  computeCanvasViewportLayout,
  scrollForFrameOrigin,
  scrollToWorld,
  worldToScroll,
  type CanvasViewportLayout,
} from '../utils/canvas-viewport-layout'
import {
  computeVisibleWorldCenter,
  setEditorVisibleWorldCenter,
} from '../utils/editor-viewport-center'
import { clampEditorZoom } from '../utils/editor-zoom'
import type { EditorTool } from '../utils/runtime-sync-service'

export type UseEditorCanvasViewportParams = Readonly<{
  scrollRef: RefObject<HTMLDivElement | null>
  layout: CanvasViewportLayout
  zoom: number
  preview: boolean
  worldSize: Readonly<{ x: number; y: number }>
  viewportSize: Readonly<{ x: number; y: number }>
  dispatch: Dispatch<Action>
  selectedSceneId: string | undefined
  selectedEntityId: number | null | undefined
  project: ProjectDoc | null
  isPlaying: boolean
  activeTool: EditorTool
  /** Scroll viewport size in device px — keeps wheel-zoom layout centred. */
  clientSize: Readonly<{ x: number; y: number }> | null
  /** Edge overscroll headroom (device px) mirrored from the panel layout. */
  overscrollPx: number
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

export function useEditorCanvasViewport({
  scrollRef,
  layout,
  zoom,
  preview,
  worldSize,
  viewportSize,
  dispatch,
  selectedSceneId,
  selectedEntityId,
  project,
  isPlaying,
  activeTool,
  clientSize,
  overscrollPx,
}: UseEditorCanvasViewportParams): EditorCanvasViewportHandlers {
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    scrollX: number
    scrollY: number
  } | null>(null)
  const prevSelectedEntityRef = useRef<number | null>(null)
  const scrollAlignKeyRef = useRef('')

  /** Re-anchor scroll when scene size or viewport measure changes so centring padding applies. */
  useLayoutEffect(() => {
    if (isPlaying) return
    const el = scrollRef.current
    if (!el) return
    const key = [
      selectedSceneId ?? '',
      worldSize.x, worldSize.y,
      viewportSize.x, viewportSize.y,
      clientSize?.x ?? 0, clientSize?.y ?? 0,
      layout.contentOffsetPx.x, layout.contentOffsetPx.y,
      layout.contentSizePx.x, layout.contentSizePx.y,
      layout.zoom,
    ].join(':')
    if (scrollAlignKeyRef.current === key) return
    scrollAlignKeyRef.current = key

    const { scrollLeft, scrollTop } = scrollForFrameOrigin(layout)
    const maxX = Math.max(0, el.scrollWidth - el.clientWidth)
    const maxY = Math.max(0, el.scrollHeight - el.clientHeight)
    el.scrollLeft = Math.min(maxX, Math.max(0, scrollLeft))
    el.scrollTop = Math.min(maxY, Math.max(0, scrollTop))
  }, [
    isPlaying,
    scrollRef,
    selectedSceneId,
    worldSize.x,
    worldSize.y,
    viewportSize.x,
    viewportSize.y,
    clientSize?.x,
    clientSize?.y,
    layout,
  ])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) {
      setEditorVisibleWorldCenter(null)
      return undefined
    }
    const publish = () => {
      setEditorVisibleWorldCenter(
        computeVisibleWorldCenter(
          el.scrollLeft, el.scrollTop, el.clientWidth, el.clientHeight, layout,
        ),
      )
    }
    publish()
    el.addEventListener('scroll', publish, { passive: true })
    const ro = new ResizeObserver(() => publish())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', publish)
      ro.disconnect()
      setEditorVisibleWorldCenter(null)
    }
  }, [scrollRef, layout, selectedSceneId])

  useEffect(() => {
    if (!isPlaying) return
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => el.focus({ preventScroll: true }))
  }, [isPlaying, scrollRef])

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
    const el = scrollRef.current
    if (!el) return
    const { x, y } = def.transform.position
    const { scrollLeft: targetX, scrollTop: targetY } = worldToScroll(
      { x, y },
      layout,
      { x: el.clientWidth * 0.5, y: el.clientHeight * 0.5 },
    )
    const maxX = Math.max(0, el.scrollWidth - el.clientWidth)
    const maxY = Math.max(0, el.scrollHeight - el.clientHeight)
    el.scrollLeft = Math.min(maxX, Math.max(0, targetX))
    el.scrollTop  = Math.min(maxY, Math.max(0, targetY))
  }, [selectedEntityId, project, layout, scrollRef])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current
    if (!el) return
    const wantsPan = e.button === 1 || (e.button === 0 && activeTool === 'pan')
    if (!wantsPan) return

    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    panStartRef.current = {
      pointerId: e.pointerId,
      clientX:   e.clientX,
      clientY:   e.clientY,
      scrollX:   el.scrollLeft,
      scrollY:   el.scrollTop,
    }
    setIsPanning(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pan = panStartRef.current
    const el  = scrollRef.current
    if (!pan || !el) return
    el.scrollLeft = pan.scrollX - (e.clientX - pan.clientX)
    el.scrollTop  = pan.scrollY - (e.clientY - pan.clientY)
  }

  function onPointerUp() {
    const pan = panStartRef.current
    const el  = scrollRef.current
    if (!pan || !el) return
    if (el.hasPointerCapture(pan.pointerId)) el.releasePointerCapture(pan.pointerId)
    panStartRef.current = null
    setIsPanning(false)
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey) return
    e.preventDefault()
    const el = scrollRef.current
    if (!el) return

    const rect    = el.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    const world = scrollToWorld(el.scrollLeft, el.scrollTop, layout, { x: cursorX, y: cursorY })

    const factor = e.deltaY < 0 ? EDITOR_ZOOM_WHEEL_FACTOR : 1 / EDITOR_ZOOM_WHEEL_FACTOR
    const nextZoom = clampEditorZoom(zoom * factor)
    dispatch({ type: 'EDITOR_SET_ZOOM', zoom: nextZoom })

    const nextLayout = computeCanvasViewportLayout({
      worldSize,
      viewportSize,
      zoom: nextZoom,
      preview,
      clientSize: clientSize ?? undefined,
      overscrollPx,
    })

    requestAnimationFrame(() => {
      if (!scrollRef.current) return
      const nextScroll = worldToScroll(world, nextLayout, { x: cursorX, y: cursorY })
      scrollRef.current.scrollLeft = nextScroll.scrollLeft
      scrollRef.current.scrollTop  = nextScroll.scrollTop
    })
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
