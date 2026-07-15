import type { EditorViewState } from './wasm-bridge'
import type { PresentationSnapshot } from './presentation-snapshot'

export const DEFAULT_EDITOR_CAMERA_VIEW: EditorViewState = { x: 0, y: 0, zoomDevice: 1 }

/**
 * Maps a committed presentation snapshot to editor camera fields for React overlays.
 * `surfacePixelsPerWorldUnit` is already device-px-per-world (C++ editorCamera.zoom).
 * @param snapshot committed snapshot (scene-edit mode fields)
 * @param _devicePixelRatio unused — kept for call-site compatibility
 */
export function editorViewFromSnapshot(
  snapshot: PresentationSnapshot,
  _devicePixelRatio: number = typeof window !== 'undefined' && window.devicePixelRatio > 0
    ? window.devicePixelRatio
    : 1,
): EditorViewState {
  const zoomDevice = snapshot.surfacePixelsPerWorldUnit > 0
    ? snapshot.surfacePixelsPerWorldUnit
    : 1
  return {
    x: snapshot.editorViewOrigin.x,
    y: snapshot.editorViewOrigin.y,
    zoomDevice,
  }
}

/**
 * Visible world centre from committed snapshot bounds (same revision as overlays).
 * @param snapshot committed presentation snapshot
 */
export function visibleWorldCenterFromSnapshot(
  snapshot: PresentationSnapshot,
): Readonly<{ x: number; y: number }> {
  const bounds = snapshot.visibleWorldBounds
  return {
    x: (bounds.minX + bounds.maxX) * 0.5,
    y: (bounds.minY + bounds.maxY) * 0.5,
  }
}

/**
 * CSS zoom from snapshot device zoom (surface pixels ÷ DPR).
 * @param snapshot committed presentation snapshot
 * @param devicePixelRatio host device pixel ratio
 */
export function editorZoomCssFromSnapshot(
  snapshot: PresentationSnapshot,
  devicePixelRatio: number,
): number {
  const device = snapshot.surfacePixelsPerWorldUnit > 0
    ? snapshot.surfacePixelsPerWorldUnit
    : 1
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1
  return device / dpr
}
