// ---------------------------------------------------------------------------
// canvas-viewport-layout — scroll ↔ world math for editor canvas + rulers
// ---------------------------------------------------------------------------

import { EDITOR_CANVAS_PADDING_PX } from '../constants/editor-viewport'

export type CanvasViewportLayout = Readonly<{
  /** Half of EDITOR_CANVAS_PADDING_PX per edge (Tailwind p-2 = 8px). */
  paddingPx: number
  /** Top-left of the scene frame inside scroll content. */
  contentOffsetPx: Readonly<{ x: number; y: number }>
  /** Scene frame size in device pixels (viewport clip when preview). */
  contentSizePx: Readonly<{ x: number; y: number }>
  worldSize: Readonly<{ x: number; y: number }>
  viewportSize: Readonly<{ x: number; y: number }>
  zoom: number
  preview: boolean
  /** World coordinates at the frame top-left. Initial camera preview starts at (0,0). */
  worldOriginOffset: Readonly<{ x: number; y: number }>
  /** Base world distance between labelled ruler ticks (auto-doubled when zoomed out). */
  rulerStep: number
}>

export type RulerTick = Readonly<{
  worldValue: number
  /** Position within the visible ruler strip (px from its leading edge). */
  positionPx: number
}>

const BASE_RULER_TICK_STEP = 64
const MIN_TICK_SCREEN_PX = 24
const MAX_RULER_TICK_STEP = 4096

export function computeCanvasViewportLayout(params: Readonly<{
  worldSize: Readonly<{ x: number; y: number }>
  viewportSize: Readonly<{ x: number; y: number }>
  zoom: number
  preview: boolean
  /** Base world distance between ruler ticks. Defaults to BASE_RULER_TICK_STEP. */
  rulerStep?: number
}>): CanvasViewportLayout {
  const paddingPx = EDITOR_CANVAS_PADDING_PX / 2
  const { worldSize, viewportSize, preview } = params
  const z = params.zoom > 0 ? params.zoom : 1
  const rulerStep = params.rulerStep && params.rulerStep > 0
    ? params.rulerStep
    : BASE_RULER_TICK_STEP

  const contentW = preview
    ? Math.round(viewportSize.x * z)
    : Math.round(worldSize.x * z)
  const contentH = preview
    ? Math.round(viewportSize.y * z)
    : Math.round(worldSize.y * z)

  const worldOriginOffset = { x: 0, y: 0 }

  return {
    paddingPx,
    contentOffsetPx: { x: paddingPx, y: paddingPx },
    contentSizePx: { x: contentW, y: contentH },
    worldSize,
    viewportSize,
    zoom: z,
    preview,
    worldOriginOffset,
    rulerStep,
  }
}

/** World-space step between major ruler ticks; grows when zoomed out. */
export function pickRulerTickStep(
  zoom: number,
  baseStep: number = BASE_RULER_TICK_STEP,
): number {
  const z = zoom > 0 ? zoom : 1
  let step = baseStep > 0 ? baseStep : BASE_RULER_TICK_STEP
  while (step * z < MIN_TICK_SCREEN_PX && step < MAX_RULER_TICK_STEP) {
    step *= 2
  }
  return step
}

/** World point under a viewport-local pixel (default origin = top-left). */
export function scrollToWorld(
  scrollLeft: number,
  scrollTop: number,
  layout: CanvasViewportLayout,
  viewportOffsetPx: Readonly<{ x: number; y: number }> = { x: 0, y: 0 },
): Readonly<{ x: number; y: number }> {
  const z = layout.zoom
  const { contentOffsetPx, worldOriginOffset } = layout
  return {
    x: worldOriginOffset.x + (scrollLeft + viewportOffsetPx.x - contentOffsetPx.x) / z,
    y: worldOriginOffset.y + (scrollTop + viewportOffsetPx.y - contentOffsetPx.y) / z,
  }
}

/** Scroll offsets that place `world` at `viewportOffsetPx` inside the scroll viewport. */
export function worldToScroll(
  world: Readonly<{ x: number; y: number }>,
  layout: CanvasViewportLayout,
  viewportOffsetPx: Readonly<{ x: number; y: number }> = { x: 0, y: 0 },
): Readonly<{ scrollLeft: number; scrollTop: number }> {
  const z = layout.zoom
  const { contentOffsetPx, worldOriginOffset } = layout
  return {
    scrollLeft: contentOffsetPx.x + (world.x - worldOriginOffset.x) * z - viewportOffsetPx.x,
    scrollTop: contentOffsetPx.y + (world.y - worldOriginOffset.y) * z - viewportOffsetPx.y,
  }
}

/** Major ticks for one ruler axis, aligned to absolute world coordinates. */
export function rulerLabelsForAxis(
  axis: 'x' | 'y',
  scrollOffset: number,
  viewportLength: number,
  layout: CanvasViewportLayout,
): readonly RulerTick[] {
  const step = pickRulerTickStep(layout.zoom, layout.rulerStep)
  const z = layout.zoom
  const worldOrigin = axis === 'x' ? layout.worldOriginOffset.x : layout.worldOriginOffset.y
  const worldMax = axis === 'x' ? layout.worldSize.x : layout.worldSize.y
  const contentOffset = axis === 'x' ? layout.contentOffsetPx.x : layout.contentOffsetPx.y

  const worldAtEdge = worldOrigin + (scrollOffset - contentOffset) / z
  let firstTick = Math.floor(worldAtEdge / step) * step
  if (firstTick < 0) firstTick = 0

  const ticks: RulerTick[] = []
  const maxScreen = step * z

  for (let w = firstTick; w <= worldMax + step; w += step) {
    const positionPx = contentOffset + (w - worldOrigin) * z - scrollOffset
    if (positionPx > viewportLength + maxScreen) break
    if (positionPx < -maxScreen) continue
    ticks.push({ worldValue: w, positionPx })
  }

  return ticks
}

/** Total scrollable content extent (padding + frame; top-left anchored, no centering). */
export function scrollContentSizePx(layout: CanvasViewportLayout): Readonly<{ x: number; y: number }> {
  return {
    x: layout.contentOffsetPx.x * 2 + layout.contentSizePx.x,
    y: layout.contentOffsetPx.y * 2 + layout.contentSizePx.y,
  }
}
