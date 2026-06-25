// ---------------------------------------------------------------------------
// Tilemap authoring model (Scene Editor — Phase C, editor-side).
//
// The grid is authored in the editor and persisted in ProjectDoc/SceneDef.
// Runtime collision is generated from each tile's CollisionBody profile.
// ---------------------------------------------------------------------------

import {
  TILEMAP_GRID_DEFAULT_LIMITS,
  TILEMAP_GRID_TILESIZE_CHANGE_LIMITS,
  computeTilemapGridDims,
} from './tilemap-grid'
import type { CollisionBodyComponent } from './components'

/** A paintable tile in the palette. `color` is the editor preview swatch; */
/** id 0 is reserved as "empty" and is never stored in the palette.          */
export interface TileDef {
  id:    number    // >= 1
  name:  string
  color: string    // hex preview colour (editor only)
  collisionBody?: CollisionBodyComponent
}

/** One tileset spritesheet registered as a paint source on a layer. */
export interface TilesetSourceRef {
  tilesetAssetId: string
}

/** A flat tile grid for a scene. `data` length === cols*rows, 0 = empty. */
export interface TilemapLayer {
  tileSize: number   // px per cell
  cols:     number
  rows:     number
  data:     number[] // row-major, values are tile ids (0 = empty)
  /** Parallel to data; 0 = empty; 1..N indexes tilesetSources[N-1]. */
  sourceIndices?: number[]
  /** Tileset spritesheets used on this layer (order defines sourceIndex). */
  tilesetSources?: TilesetSourceRef[]
  /**
   * @deprecated Read only for legacy migration. New saves use tilesetSources.
   * When set without sourceIndices, all painted cells map to source index 1.
   */
  tilesetAssetId?: string
  /** Optional default brush tileset for the layer (editor hint). */
  defaultTilesetAssetId?: string
}

/**
 * A spritesheet tileset (Phase F). Tiles are uniform cells of one image,
 * laid out left→right, top→bottom. Cell id is 1-based (0 = empty).
 * `cols`/`rows` are derived from the image size and stored for the runtime.
 */
export interface TilesetAsset {
  assetId:         string  // stable id, e.g. "tileset_forest_01"
  name:            string
  spriteImagePath: string  // project-relative path under assets/tilesets/
  contentHash?:    string
  tileSize:        number  // px per cell (square)
  margin:          number  // px gap between cells (default 0)
  cols:            number  // derived: floor((imgW + margin) / (tileSize + margin))
  rows:            number  // derived from image height
  /** Transient in-memory preview (editor only; not persisted in project.json). */
  previewDataUrl?: string
}

export function tilesetCellCount(t: TilesetAsset): number {
  return Math.max(0, t.cols) * Math.max(0, t.rows)
}

function tileSolidBody(oneWay: boolean): CollisionBodyComponent {
  return {
    bodyType: 'static',
    enabled: true,
    shapes: [{
      type: 'rectangle',
      response: 'solid',
      role: 'body',
      layerId: 'ground',
      maskLayerIds: ['player', 'enemy', 'projectile'],
      offsetX: 0,
      offsetY: 0,
      width: 32,
      height: 32,
      radius: 16,
      enabled: true,
      oneWay,
      friction: 0.3,
      restitution: 0,
      density: 1,
    }],
  }
}

function tileSensorBody(layerId: string, role: 'hitbox' | 'interaction'): CollisionBodyComponent {
  return {
    bodyType: 'static',
    enabled: true,
    shapes: [{
      type: 'rectangle',
      response: 'sensor',
      role,
      layerId,
      maskLayerIds: ['player'],
      offsetX: 0,
      offsetY: 0,
      width: 32,
      height: 32,
      radius: 16,
      enabled: true,
      oneWay: false,
      friction: 0,
      restitution: 0,
      density: 1,
    }],
  }
}

export const DEFAULT_TILE_PALETTE: TileDef[] = [
  { id: 1, name: 'Ground', color: '#22D3EE', collisionBody: tileSolidBody(false) },
  { id: 2, name: 'Spike',  color: '#F87171', collisionBody: tileSensorBody('hazard', 'hitbox') },
  { id: 3, name: 'Coin',   color: '#FBBF24', collisionBody: tileSensorBody('pickup', 'interaction') },
  { id: 4, name: 'Wall',   color: '#9CA3AF', collisionBody: tileSolidBody(false) },
  { id: 5, name: 'Water',  color: '#3B82F6' },
  { id: 6, name: 'OneWay', color: '#A78BFA', collisionBody: tileSolidBody(true) },
]

/** A fresh empty tilemap sized to the scene world (clamped to a sane range). */
export function createTilemap(
  worldW: number,
  worldH: number,
  tileSize = 32,
): TilemapLayer {
  const { cols, rows } = computeTilemapGridDims(
    worldW,
    worldH,
    tileSize,
    TILEMAP_GRID_DEFAULT_LIMITS,
  )
  return { tileSize, cols, rows, data: new Array(cols * rows).fill(0) }
}

/**
 * Resolve tileSize for a layer that does not exist yet.
 * Must stay in sync with resolve_scene_tilemap_tile_size in editor-api.cpp.
 * Priority: paint tileset → any existing layer → merged tilemap → 32.
 */
export function resolveTilemapTileSize(
  project: { tilesets?: Record<string, { tileSize: number }> },
  scene: { tilemap?: TilemapLayer; tilemapLayers?: Record<string, TilemapLayer> },
  tilesetAssetId?: string,
): number {
  const fromTileset = tilesetAssetId ? project.tilesets?.[tilesetAssetId]?.tileSize : undefined
  if (fromTileset && fromTileset > 0) return fromTileset
  const layers = scene.tilemapLayers
  if (layers) {
    for (const layer of Object.values(layers)) {
      if (layer.tileSize > 0) return layer.tileSize
    }
  }
  if (scene.tilemap?.tileSize && scene.tilemap.tileSize > 0) return scene.tilemap.tileSize
  return 32
}

/**
 * Create an empty layer grid aligned with existing scene tilemaps.
 * Reuses cols/rows from any existing layer so all layers stay in sync.
 */
export function createTilemapForNewLayer(
  worldW: number,
  worldH: number,
  tileSize: number,
  scene: { tilemapLayers?: Record<string, TilemapLayer> },
): TilemapLayer {
  const layers = scene.tilemapLayers
  if (layers) {
    for (const layer of Object.values(layers)) {
      if (layer.cols > 0 && layer.rows > 0) {
        const size = layer.cols * layer.rows
        return {
          tileSize: layer.tileSize,
          cols: layer.cols,
          rows: layer.rows,
          data: new Array(size).fill(0),
        }
      }
    }
  }
  const limits = tileSize === 32
    ? TILEMAP_GRID_DEFAULT_LIMITS
    : TILEMAP_GRID_TILESIZE_CHANGE_LIMITS
  const { cols, rows } = computeTilemapGridDims(worldW, worldH, tileSize, limits)
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

  const sourceIndices = tilemap.sourceIndices
    ? new Array(next.cols * next.rows).fill(0)
    : undefined

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dst = row * next.cols + col
      const src = row * tilemap.cols + col
      data[dst] = tilemap.data[src] ?? 0
      if (sourceIndices && tilemap.sourceIndices) {
        sourceIndices[dst] = tilemap.data[src] !== 0 ? (tilemap.sourceIndices[src] ?? 0) : 0
      }
    }
  }

  return {
    ...tilemap,
    cols: next.cols,
    rows: next.rows,
    data,
    ...(sourceIndices ? { sourceIndices } : {}),
  }
}

/**
 * Resize a layer when tileSize changes while preserving overlapping cells.
 * Uses wider grid caps than createTilemap (smaller tiles → more cells).
 */
export function resizeTilemapForTileSize(
  tilemap: TilemapLayer,
  worldW: number,
  worldH: number,
  newTileSize: number,
): TilemapLayer {
  if (tilemap.tileSize === newTileSize) return tilemap
  const { cols: newCols, rows: newRows } = computeTilemapGridDims(
    worldW,
    worldH,
    newTileSize,
    TILEMAP_GRID_TILESIZE_CHANGE_LIMITS,
  )
  const data = new Array(newCols * newRows).fill(0)
  const copyC = Math.min(tilemap.cols, newCols)
  const copyR = Math.min(tilemap.rows, newRows)

  const sourceIndices = tilemap.sourceIndices
    ? new Array(newCols * newRows).fill(0)
    : undefined

  for (let row = 0; row < copyR; row++) {
    for (let col = 0; col < copyC; col++) {
      const dst = row * newCols + col
      const src = row * tilemap.cols + col
      const cell = tilemap.data[src] ?? 0
      data[dst] = cell
      if (sourceIndices && tilemap.sourceIndices) {
        sourceIndices[dst] = cell !== 0 ? (tilemap.sourceIndices[src] ?? 0) : 0
      }
    }
  }

  return {
    ...tilemap,
    tileSize: newTileSize,
    cols: newCols,
    rows: newRows,
    data,
    ...(sourceIndices ? { sourceIndices } : {}),
  }
}

/**
 * Composite per-layer tilemap data into a single TilemapLayer for legacy physics.
 * `layerIds` is ordered highest-to-lowest priority (index 0 = renders on top).
 * Higher-priority layers win wherever tileId !== 0; empty cells (0) fall through.
 *
 * Merged grid carries tileId only — it does not represent multi-source intra-layer
 * paint. Per-layer tilemapLayers + sourceIndices are authoritative for rendering.
 */
export function mergeTilemapLayers(
  layerIds: string[],
  tilemapLayers: Record<string, TilemapLayer>,
): TilemapLayer | undefined {
  const ordered = layerIds
    .map(id => tilemapLayers[id])
    .filter((tm): tm is TilemapLayer => !!tm)
  if (ordered.length === 0) return undefined

  const ref = ordered[0]!
  const size = ref.cols * ref.rows
  const data = new Array<number>(size).fill(0)

  for (let li = ordered.length - 1; li >= 0; li--) {
    const tm = ordered[li]!
    const len = Math.min(size, tm.data.length)
    for (let i = 0; i < len; i++) {
      if (tm.data[i] !== 0) data[i] = tm.data[i]!
    }
  }

  return {
    tileSize: ref.tileSize,
    cols:     ref.cols,
    rows:     ref.rows,
    data,
  }
}
