// ---------------------------------------------------------------------------
// Tilemap authoring model (Scene Editor — Phase C, editor-side).
//
// The grid is authored in the editor and persisted in ProjectDoc/SceneDef.
// Runtime: tilemap render + platformer grounding use the same surface rules as
// SolidComponent (groundClass, surfaceKind). Static physics bodies per solid tile remain
// for generic physics overlap.
// ---------------------------------------------------------------------------

/** A paintable tile in the palette. `color` is the editor preview swatch; */
/** id 0 is reserved as "empty" and is never stored in the palette.          */
export interface TileDef {
  id:    number    // >= 1
  name:  string
  color: string    // hex preview colour (editor only)
  solid: boolean    // blocks movement + platformer / physics collider when true
  /** Matches SolidComponent.groundClass (default Ground). */
  groundClass?: string
  /** Matches SolidComponent.surfaceKind (default solid). */
  surfaceKind?: 'solid' | 'oneWay'
}

/** A flat tile grid for a scene. `data` length === cols*rows, 0 = empty. */
export interface TilemapLayer {
  tileSize: number   // px per cell
  cols:     number
  rows:     number
  data:     number[] // row-major, values are tile ids (0 = empty)
  /** Phase F: reference to a ProjectDoc.tilesets entry. When set, tiles are
   *  drawn as cells of that spritesheet (id = 1-based cell index); when
   *  absent, the legacy TileDef/palette colour fallback (D2) is used. */
  tilesetAssetId?: string
}

/**
 * A spritesheet tileset (Phase F). Tiles are uniform cells of one image,
 * laid out left→right, top→bottom. Cell id is 1-based (0 = empty).
 * `cols`/`rows` are derived from the image size and stored for the runtime.
 */
export interface TilesetAsset {
  assetId:         string  // stable id, e.g. "tileset_forest_01"
  name:            string
  spriteImagePath: string  // path/URL to the spritesheet image
  tileSize:        number  // px per cell (square)
  margin:          number  // px gap between cells (default 0)
  cols:            number  // derived: floor((imgW + margin) / (tileSize + margin))
  rows:            number  // derived from image height
}

export function tilesetCellCount(t: TilesetAsset): number {
  return Math.max(0, t.cols) * Math.max(0, t.rows)
}

export const DEFAULT_TILE_PALETTE: TileDef[] = [
  { id: 1, name: 'Ground', color: '#22D3EE', solid: true  },
  { id: 2, name: 'Spike',  color: '#F87171', solid: true  },
  { id: 3, name: 'Coin',   color: '#FBBF24', solid: false },
  { id: 4, name: 'Wall',   color: '#9CA3AF', solid: true  },
  { id: 5, name: 'Water',  color: '#3B82F6', solid: false },
  { id: 6, name: 'OneWay', color: '#A78BFA', solid: true, surfaceKind: 'oneWay' },
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

/** Resize a tilemap to a new world size while preserving overlapping cells. */
export function resizeTilemap(
  tilemap: TilemapLayer,
  worldW: number,
  worldH: number,
): TilemapLayer {
  const next = createTilemap(worldW, worldH, tilemap.tileSize)
  const data = next.data.slice()
  const cols = Math.min(tilemap.cols, next.cols)
  const rows = Math.min(tilemap.rows, next.rows)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      data[row * next.cols + col] = tilemap.data[row * tilemap.cols + col] ?? 0
    }
  }

  return {
    ...tilemap,
    cols: next.cols,
    rows: next.rows,
    data,
  }
}

/**
 * Composite per-layer tilemap data into a single TilemapLayer for the WASM runtime.
 * `layerNames` is ordered highest-to-lowest priority (index 0 = renders on top).
 * Higher-priority layers win wherever tileId !== 0; empty cells (0) fall through.
 */
export function mergeTilemapLayers(
  layerNames: string[],
  tilemapLayers: Record<string, TilemapLayer>,
): TilemapLayer | undefined {
  // Collect existing layers ordered highest→lowest priority
  const ordered = layerNames
    .map(n => tilemapLayers[n])
    .filter((tm): tm is TilemapLayer => !!tm)
  if (ordered.length === 0) return undefined

  const ref = ordered[0]!
  const size = ref.cols * ref.rows
  const data = new Array<number>(size).fill(0)

  // Paint bottom-up: lowest priority first, then higher layers overwrite non-zero
  for (let li = ordered.length - 1; li >= 0; li--) {
    const tm = ordered[li]!
    const len = Math.min(size, tm.data.length)
    for (let i = 0; i < len; i++) {
      if (tm.data[i] !== 0) data[i] = tm.data[i]!
    }
  }

  // Tileset: highest-priority layer that has one assigned
  const tilesetLayer = ordered.find(tm => tm.tilesetAssetId)

  return {
    tileSize: ref.tileSize,
    cols:     ref.cols,
    rows:     ref.rows,
    data,
    tilesetAssetId: tilesetLayer?.tilesetAssetId,
  }
}
