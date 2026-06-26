// ---------------------------------------------------------------------------
// editor-ruler-metrics — ruler tick math from the presentation snapshot
// ---------------------------------------------------------------------------
//
// Fixed-surface editor viewport (overflow-hidden + ViewController pan/zoom).
// No scrollLeft/scrollTop or content-offset vocabulary — rulers read the same
// committed snapshot revision as WASM rendering and picking.

import { EDITOR_CANVAS_PADDING_PX } from '../constants/editor-viewport'
import type { PresentationSnapshot } from './presentation-snapshot'

/** Half of EDITOR_CANVAS_PADDING_PX per edge (Tailwind p-2 = 8px). */
export const EDITOR_CANVAS_PADDING_HALF_PX = EDITOR_CANVAS_PADDING_PX / 2

const BASE_RULER_TICK_STEP = 64
const MIN_TICK_SCREEN_PX = 24
const MAX_RULER_TICK_STEP = 4096

export type EditorRulerMetrics = Readonly<{
  paddingPx: number
  zoom: number
  rulerStep: number
  worldMaxX: number
  worldMaxY: number
}>

export type RulerTick = Readonly<{
  worldValue: number
  /** Position within the visible ruler strip (px from its leading edge). */
  positionPx: number
}>

/**
 * Builds ruler metrics from the committed presentation snapshot.
 * @param presentationSnapshot committed frame (null before engine ready)
 * @param fallbackZoom CSS zoom when snapshot is not yet available
 * @param rulerStep base world distance between labelled ticks
 * @param worldSize scene world extent for tick upper bound
 */
export function buildEditorRulerMetrics(params: Readonly<{
  presentationSnapshot: PresentationSnapshot | null
  fallbackZoom: number
  rulerStep: number
  worldSize: Readonly<{ x: number; y: number }>
}>): EditorRulerMetrics {
  const snapshotZoom = params.presentationSnapshot?.surfacePixelsPerWorldUnit
  const zoom = snapshotZoom != null && snapshotZoom > 0
    ? snapshotZoom
    : (params.fallbackZoom > 0 ? params.fallbackZoom : 1)
  const bounds = params.presentationSnapshot?.visibleWorldBounds
  const baseStep = params.rulerStep > 0 ? params.rulerStep : BASE_RULER_TICK_STEP
  return {
    paddingPx: EDITOR_CANVAS_PADDING_HALF_PX,
    zoom,
    rulerStep: baseStep,
    worldMaxX: bounds?.maxX ?? params.worldSize.x,
    worldMaxY: bounds?.maxY ?? params.worldSize.y,
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

/** Major ticks for one ruler axis using editor camera origin (fixed surface). */
export function rulerLabelsForCameraAxis(
  axis: 'x' | 'y',
  cameraWorldOrigin: Readonly<{ x: number; y: number }>,
  viewportLength: number,
  metrics: EditorRulerMetrics,
): readonly RulerTick[] {
  const step = pickRulerTickStep(metrics.zoom, metrics.rulerStep)
  const z = metrics.zoom
  const worldOrigin = axis === 'x' ? cameraWorldOrigin.x : cameraWorldOrigin.y
  const worldMax = axis === 'x' ? metrics.worldMaxX : metrics.worldMaxY

  const worldAtEdge = worldOrigin
  let firstTick = Math.floor(worldAtEdge / step) * step
  if (firstTick < 0) firstTick = 0

  const ticks: RulerTick[] = []
  const maxScreen = step * z

  for (let w = firstTick; w <= worldMax + step; w += step) {
    const positionPx = (w - worldOrigin) * z
    if (positionPx > viewportLength + maxScreen) break
    if (positionPx < -maxScreen) continue
    ticks.push({ worldValue: w, positionPx })
  }

  return ticks
}
