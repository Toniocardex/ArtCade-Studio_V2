// ---------------------------------------------------------------------------
// camera-start — clamp the scene's initial camera position to the world
// ---------------------------------------------------------------------------
//
// The camera's initial view is a viewport-sized rectangle whose top-left is
// `cameraStart`. It must stay inside the world: the top-left can range from
// (0,0) to (worldSize - viewportSize). When the world is no larger than the
// viewport on an axis the only valid value is 0 (the view already covers it).

import type { Vec2 } from '../types'

export function clampCameraStart(
  world: Vec2,
  viewport: Vec2,
  pos: Vec2,
): Vec2 {
  const maxX = Math.max(0, world.x - viewport.x)
  const maxY = Math.max(0, world.y - viewport.y)
  return {
    x: Math.min(maxX, Math.max(0, pos.x)),
    y: Math.min(maxY, Math.max(0, pos.y)),
  }
}
