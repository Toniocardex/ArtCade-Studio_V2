// ---------------------------------------------------------------------------
// tilemap-grid — editor↔runtime contract for tilemap grid dimensions.
//
// Must stay in sync with runtime-cpp/src/core/tilemap_grid.h (same pattern as
// ProjectRuntimeSettings ↔ runtime-fingerprint.ts).
// ---------------------------------------------------------------------------

/** Default grid when creating/ensuring a layer from world size (createTilemap, WASM ensure layer). */
export const TILEMAP_GRID_DEFAULT_LIMITS = {
  minCols: 8,
  minRows: 6,
  maxCols: 64,
  maxRows: 48,
} as const

/** Wider caps when only tileSize changes (smaller tiles → more cells). */
export const TILEMAP_GRID_TILESIZE_CHANGE_LIMITS = {
  minCols: 8,
  minRows: 6,
  maxCols: 128,
  maxRows: 96,
} as const

export type TilemapGridLimits = {
  minCols: number
  minRows: number
  maxCols: number
  maxRows: number
}

const DEFAULT_TILE_SIZE = 32

function clampDim(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Compute tilemap column/row counts from scene world size and cell size.
 * @param worldW scene width in world units (px)
 * @param worldH scene height in world units (px)
 * @param tileSize cell size in px (must be > 0; falls back to 32)
 * @param limits clamp range for cols/rows
 */
export function computeTilemapGridDims(
  worldW: number,
  worldH: number,
  tileSize: number,
  limits: TilemapGridLimits = TILEMAP_GRID_DEFAULT_LIMITS,
): { cols: number; rows: number } {
  const step = tileSize > 0 ? tileSize : DEFAULT_TILE_SIZE
  const cols = clampDim(Math.round(worldW / step), limits.minCols, limits.maxCols)
  const rows = clampDim(Math.round(worldH / step), limits.minRows, limits.maxRows)
  return { cols, rows }
}
