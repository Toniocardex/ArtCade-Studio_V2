import type { Vec2 } from '../types'

let visibleWorldCenter: Vec2 | null = null

/** Updated by PreviewPanel from editor camera + viewport size. */
export function setEditorVisibleWorldCenter(center: Vec2 | null): void {
  visibleWorldCenter = center
}

/** World point at the centre of the editor canvas viewport, if known. */
export function getEditorVisibleWorldCenter(): Vec2 | null {
  return visibleWorldCenter
}

export function computeVisibleWorldCenter(
  cameraTopLeftX: number,
  cameraTopLeftY: number,
  clientWidth: number,
  clientHeight: number,
  editorZoom: number,
): Vec2 {
  const z = editorZoom > 0 ? editorZoom : 1
  return {
    x: cameraTopLeftX + clientWidth / (2 * z),
    y: cameraTopLeftY + clientHeight / (2 * z),
  }
}
