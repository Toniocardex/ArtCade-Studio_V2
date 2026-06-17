import { describe, expect, it } from 'vitest'
import {
  TILEMAP_GRID_DEFAULT_LIMITS,
  computeTilemapGridDims,
} from './tilemap-grid'
import { createTilemap } from './tilemap'

describe('computeTilemapGridDims', () => {
  it('matches createTilemap for standard world size', () => {
    const dims = computeTilemapGridDims(640, 320, 32)
    expect(dims).toEqual({ cols: 20, rows: 10 })
    const tm = createTilemap(640, 320, 32)
    expect(tm.cols).toBe(dims.cols)
    expect(tm.rows).toBe(dims.rows)
  })

  it('clamps cols to minimum 8', () => {
    expect(computeTilemapGridDims(50, 50, 32).cols).toBe(8)
  })

  it('clamps cols to maximum 64', () => {
    expect(computeTilemapGridDims(9999, 9999, 32).cols).toBe(64)
  })

  it('clamps rows to minimum 6', () => {
    expect(computeTilemapGridDims(640, 50, 32).rows).toBe(6)
  })

  it('clamps rows to maximum 48', () => {
    expect(computeTilemapGridDims(640, 9999, 32).rows).toBe(48)
  })

  it('uses round not floor for non-multiple world size', () => {
    // 50 / 32 = 1.5625 → round 2 → clamp to min 8
    expect(computeTilemapGridDims(50, 50, 32, TILEMAP_GRID_DEFAULT_LIMITS).cols).toBe(8)
    // 100 / 32 = 3.125 → round 3 → clamp to min 8
    expect(computeTilemapGridDims(100, 200, 32).cols).toBe(8)
    expect(computeTilemapGridDims(100, 200, 32).rows).toBe(6)
  })

  it('falls back to tileSize 32 when tileSize is zero', () => {
    expect(computeTilemapGridDims(640, 320, 0)).toEqual({ cols: 20, rows: 10 })
  })
})
