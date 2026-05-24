// ---------------------------------------------------------------------------
// editor-zoom — pure zoom math shared by reducer, shortcuts, wheel handler
// ---------------------------------------------------------------------------
//
// Keeping clamping/preset-stepping/fit math in one place means the reducer,
// keyboard shortcuts, Ctrl+wheel handler and ZoomControls combobox stay
// consistent. They were previously implemented four times with subtly
// different bounds (TECHNICAL_DEBT_REVIEW §9).

import {
  EDITOR_ZOOM_MIN, EDITOR_ZOOM_MAX,
  EDITOR_ZOOM_SNAP_DECIMALS, EDITOR_CANVAS_PADDING_PX,
  ZOOM_PRESETS, ZOOM_PRESET_EPSILON,
} from '../constants/editor-viewport'

/** Clamp `z` into the legal range AND snap to a fixed number of decimals. */
export function clampEditorZoom(z: number): number {
  if (!Number.isFinite(z)) return 1.0
  const clamped = Math.min(EDITOR_ZOOM_MAX, Math.max(EDITOR_ZOOM_MIN, z))
  const snap    = Math.pow(10, EDITOR_ZOOM_SNAP_DECIMALS)
  return Math.round(clamped * snap) / snap
}

/**
 * Move one step along the preset ladder. Returns the next preset strictly
 * above (dir=+1) or below (dir=-1) the current value, with an epsilon so
 * Ctrl+= doesn't bounce on already-snapped values.
 */
export function nextZoomStep(current: number, dir: 1 | -1): number {
  if (dir > 0) {
    const next = ZOOM_PRESETS.find(z => z > current + ZOOM_PRESET_EPSILON)
    return next ?? ZOOM_PRESETS[ZOOM_PRESETS.length - 1]
  }
  for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
    if (ZOOM_PRESETS[i] < current - ZOOM_PRESET_EPSILON) return ZOOM_PRESETS[i]
  }
  return ZOOM_PRESETS[0]
}

/**
 * Largest zoom factor that makes a `sceneW × sceneH` rectangle fit inside
 * `containerW × containerH`, accounting for the inner padding. Clamped to
 * the legal editor range.
 *
 * The caller decides whether `sceneW/H` is `worldSize` (default view) or
 * `viewportSize` (camera-preview mode) — this function stays agnostic.
 */
export function computeFitZoom(
  containerW: number,
  containerH: number,
  sceneW:    number,
  sceneH:    number,
  paddingPx: number = EDITOR_CANVAS_PADDING_PX,
): number {
  const availW = Math.max(1, containerW - paddingPx)
  const availH = Math.max(1, containerH - paddingPx)
  if (sceneW <= 0 || sceneH <= 0) return 1.0
  return clampEditorZoom(Math.min(availW / sceneW, availH / sceneH))
}

/** Format a zoom factor as a percentage label, e.g. 1.0 → "100%". */
export function formatZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
