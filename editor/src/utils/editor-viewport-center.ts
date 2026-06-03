import type { Vec2 } from '../types'
import {
  scrollToWorld,
  type CanvasViewportLayout,
} from './canvas-viewport-layout'

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
  layout: CanvasViewportLayout,
): Vec2 {
  return scrollToWorld(scrollLeft, scrollTop, layout, {
    x: clientWidth * 0.5,
    y: clientHeight * 0.5,
  })
}
