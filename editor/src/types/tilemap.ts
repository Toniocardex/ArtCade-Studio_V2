// ---------------------------------------------------------------------------
// Tilemap authoring model (Scene Editor — Phase C, editor-side).
//
// The grid is authored in the editor and persisted in ProjectDoc/SceneDef.
// The C++ runtime does NOT render it yet — that arrives in Phase D (Raylib
// tilemap rendering + Box2D collision for `solid` tiles). Until then this is
// pure authoring data; projects without a tilemap stay byte-identical.
// ---------------------------------------------------------------------------

/** A paintable tile in the palette. `color` is the editor preview swatch; */
/** in Phase D it will map to a real sprite/atlas cell. id 0 is reserved    */
/** as "empty" and is never stored in the palette.                          */
export interface TileDef {
  id:    number    // >= 1
  name:  string
  color: string    // hex preview colour (editor only)
  solid: boolean    // Box2D collision when rendered (Phase D)
}

/** A flat tile grid for a scene. `data` length === cols*rows, 0 = empty. */
export interface TilemapLayer {
  tileSize: number   // px per cell
  cols:     number
  rows:     number
  data:     number[] // row-major, values are TileDef.id (0 = empty)
}

export const DEFAULT_TILE_PALETTE: TileDef[] = [
  { id: 1, name: 'Ground', color: '#22D3EE', solid: true  },
  { id: 2, name: 'Spike',  color: '#F87171', solid: true  },
  { id: 3, name: 'Coin',   color: '#FBBF24', solid: false },
  { id: 4, name: 'Wall',   color: '#9CA3AF', solid: true  },
  { id: 5, name: 'Water',  color: '#3B82F6', solid: false },
]

/** A fresh empty tilemap sized to the scene world (clamped to a sane range). */
export function createTilemap(
  worldW: number,
  worldH: number,
  tileSize = 32,
): TilemapLayer {
  const cols = Math.min(Math.max(Math.round(worldW / tileSize), 8), 64)
  const rows = Math.min(Math.max(Math.round(worldH / tileSize), 6), 48)
  return { tileSize, cols, rows, data: new Array(cols * rows).fill(0) }
}
