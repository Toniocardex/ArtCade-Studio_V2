import type { Vec2 } from '../types'

let visibleWorldCenter: Vec2 | null = null

/** Updated by PreviewPanel from scroll position + zoom. */
export function setEditorVisibleWorldCenter(center: Vec2 | null): void {
  visibleWorldCenter = center
}

/** World point at the centre of the editor canvas scroll viewport, if known. */
export function getEditorVisibleWorldCenter(): Vec2 | null {
  return visibleWorldCenter
}

export function computeVisibleWorldCenter(
  scrollLeft: number,
  scrollTop: number,
  clientWidth: number,
  clientHeight: number,
  zoom: number,
): Vec2 {
  const z = zoom > 0 ? zoom : 1
  return {
    x: (scrollLeft + clientWidth * 0.5) / z,
    y: (scrollTop + clientHeight * 0.5) / z,
  }
}
