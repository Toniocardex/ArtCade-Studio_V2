// ---------------------------------------------------------------------------
// frame-selection — pure math for "F = frame the selected object"
// ---------------------------------------------------------------------------
//
// Mirrors the Unity/Godot/Blender "frame selected" gesture: zoom in on the
// selected entity and centre it. Sprite pixel bounds are owned by the C++
// runtime and not reliably known here, so we frame a fixed world span around
// the entity, widened by its transform scale so large objects (a stretched
// ground, say) still fit. The caller centres the view on `center`.

import { computeFitZoom } from './editor-zoom'

/** World span framed around a selection at scale 1 (≈ one default scene height). */
export const FRAME_SELECTION_SPAN = 320

/** Upper bound on the scale multiplier so an extreme scale can't zoom to nothing. */
const MAX_SCALE_FACTOR = 8

export type FrameSelectionView = Readonly<{
  zoom: number
  center: Readonly<{ x: number; y: number }>
}>

export function computeFrameSelectionView(params: Readonly<{
  position: Readonly<{ x: number; y: number }>
  scale?: Readonly<{ x: number; y: number }>
  clientW: number
  clientH: number
  paddingPx: number
}>): FrameSelectionView {
  const factor = (s: number | undefined) =>
    Math.min(MAX_SCALE_FACTOR, Math.max(1, Math.abs(s ?? 1) || 1))
  const spanX = FRAME_SELECTION_SPAN * factor(params.scale?.x)
  const spanY = FRAME_SELECTION_SPAN * factor(params.scale?.y)
  const zoom = computeFitZoom(params.clientW, params.clientH, spanX, spanY, params.paddingPx)
  return { zoom, center: { x: params.position.x, y: params.position.y } }
}
