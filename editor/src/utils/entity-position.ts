import type { Vec2 } from '../types'

const ENTITY_EDGE_INSET_PX = 32

/** Snap a scalar world coordinate to the editor grid. */
export function snapToGridValue(value: number, gridSize: number): number {
  return gridSize > 0 ? Math.round(value / gridSize) * gridSize : value
}

/**
 * Commit-time world position for entities — pixel integers by default,
 * grid multiples when snap is enabled.
 */
export function normalizeEntityPosition(
  x: number,
  y: number,
  snapToGrid: boolean,
  gridSize: number,
): { x: number; y: number } {
  if (snapToGrid && gridSize > 0) {
    return {
      x: snapToGridValue(x, gridSize),
      y: snapToGridValue(y, gridSize),
    }
  }
  return { x: Math.round(x), y: Math.round(y) }
}

function clampAxisToScene(value: number, size: number): number {
  const max = Math.max(0, Math.round(size))
  if (max <= ENTITY_EDGE_INSET_PX * 2) return Math.round(max * 0.5)
  return Math.min(max - ENTITY_EDGE_INSET_PX, Math.max(ENTITY_EDGE_INSET_PX, Math.round(value)))
}

export function clampEntityPositionToScene(position: Vec2, worldSize: Vec2): Vec2 {
  return {
    x: clampAxisToScene(position.x, worldSize.x),
    y: clampAxisToScene(position.y, worldSize.y),
  }
}
