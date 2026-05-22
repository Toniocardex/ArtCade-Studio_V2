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
