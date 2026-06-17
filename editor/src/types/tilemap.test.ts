import { describe, expect, it } from 'vitest'
import { createTilemap, createTilemapForNewLayer, resolveTilemapTileSize } from './tilemap'
import type { TilemapLayer } from './tilemap'

const layer16: TilemapLayer = { tileSize: 16, cols: 80, rows: 40, data: [] }
const layer32: TilemapLayer = { tileSize: 32, cols: 40, rows: 20, data: [] }

describe('resolveTilemapTileSize', () => {
  it('prefers paint tileset tileSize', () => {
    const size = resolveTilemapTileSize(
      { tilesets: { ts_a: { tileSize: 16 }, ts_b: { tileSize: 32 } } },
      { tilemapLayers: { Background: layer32 } },
      'ts_a',
    )
    expect(size).toBe(16)
  })

  it('falls back to existing layer when tileset is unknown', () => {
    const size = resolveTilemapTileSize(
      { tilesets: {} },
      { tilemapLayers: { Background: layer16 } },
      'missing',
    )
    expect(size).toBe(16)
  })

  it('falls back to merged tilemap when no layers exist', () => {
    const size = resolveTilemapTileSize(
      { tilesets: {} },
      { tilemap: layer16 },
    )
    expect(size).toBe(16)
  })

  it('defaults to 32 when scene has no tilemap context', () => {
    expect(resolveTilemapTileSize({ tilesets: {} }, {})).toBe(32)
  })

  it('createTilemap with resolved size matches 16px grid for 1280 world', () => {
    const tileSize = resolveTilemapTileSize(
      { tilesets: { ts: { tileSize: 16 } } },
      { tilemapLayers: { Background: layer16 } },
      'ts',
    )
    const tm = createTilemapForNewLayer(1280, 640, tileSize, { tilemapLayers: { Background: layer16 } })
    expect(tm.tileSize).toBe(16)
    expect(tm.cols).toBe(80)
    expect(tm.rows).toBe(40)
  })
})
