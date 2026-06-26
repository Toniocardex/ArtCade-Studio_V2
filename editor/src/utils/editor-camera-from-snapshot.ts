import type { EditorViewState } from './wasm-bridge'
import type { PresentationSnapshot } from './presentation-snapshot'

export const DEFAULT_EDITOR_CAMERA_VIEW: EditorViewState = { x: 0, y: 0, zoomDevice: 1 }

/**
 * Maps a committed presentation snapshot to editor camera fields for React overlays.
 * @param snapshot committed snapshot (scene-edit mode fields)
 * @param devicePixelRatio host DPR for CSS zoom derivation
 */
export function editorViewFromSnapshot(
  snapshot: PresentationSnapshot,
  devicePixelRatio: number = typeof window !== 'undefined' && window.devicePixelRatio > 0
    ? window.devicePixelRatio
    : 1,
): EditorViewState {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1
  const zoomDevice = snapshot.surfacePixelsPerWorldUnit * dpr
  return {
    x: snapshot.editorViewOrigin.x,
    y: snapshot.editorViewOrigin.y,
    zoomDevice: zoomDevice > 0 ? zoomDevice : 1,
  }
}

/** CSS zoom from snapshot world-units-per-css-pixel field. */
export function editorZoomCssFromSnapshot(
  snapshot: PresentationSnapshot,
  devicePixelRatio: number,
): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1
  const z = snapshot.surfacePixelsPerWorldUnit > 0
    ? snapshot.surfacePixelsPerWorldUnit
    : 1
  return z
}
