import { describe, expect, it } from 'vitest'
import {
  ensureSourceOnLayer,
  layerSourceHasCells,
  normalizeTilemapLayer,
  removeSourceFromLayer,
  sourcesUsedOnLayer,
} from './tilemap-layer-sources'
import type { TilemapLayer } from '../types/tilemap'

function layer(overrides: Partial<TilemapLayer> = {}): TilemapLayer {
  return {
    tileSize: 32,
    cols: 2,
    rows: 2,
    data: [0, 0, 0, 0],
    ...overrides,
  }
}

describe('normalizeTilemapLayer', () => {
  it('migrates legacy tilesetAssetId to source 1', () => {
    const raw = layer({
      tilesetAssetId: 'ts_a',
      data: [1, 0, 2, 0],
    })
    const n = normalizeTilemapLayer(raw)
    expect(n.tilesetSources).toEqual([{ tilesetAssetId: 'ts_a' }])
    expect(n.sourceIndices).toEqual([1, 0, 1, 0])
  })

  it('is idempotent when sources already exist', () => {
    const raw = layer({
      tilesetSources: [{ tilesetAssetId: 'ts_a' }, { tilesetAssetId: 'ts_b' }],
      sourceIndices: [1, 2, 0, 0],
      data: [1, 3, 0, 0],
    })
    const n = normalizeTilemapLayer(raw)
    expect(n.tilesetSources).toHaveLength(2)
    expect(n.sourceIndices).toEqual([1, 2, 0, 0])
  })
})

describe('ensureSourceOnLayer', () => {
  it('adds a new source and returns its 1-based index', () => {
    const { layer: next, sourceIndex, added } = ensureSourceOnLayer(
      layer({ tilesetSources: [{ tilesetAssetId: 'ts_a' }] }),
      'ts_b',
    )
    expect(added).toBe(true)
    expect(sourceIndex).toBe(2)
    expect(next.tilesetSources).toEqual([
      { tilesetAssetId: 'ts_a' },
      { tilesetAssetId: 'ts_b' },
    ])
  })

  it('reuses existing source index', () => {
    const { sourceIndex, added } = ensureSourceOnLayer(
      layer({ tilesetSources: [{ tilesetAssetId: 'ts_a' }] }),
      'ts_a',
    )
    expect(added).toBe(false)
    expect(sourceIndex).toBe(1)
  })
})

describe('sourcesUsedOnLayer', () => {
  it('returns tilesets referenced by painted cells only', () => {
    const used = sourcesUsedOnLayer(
      layer({
        tilesetSources: [
          { tilesetAssetId: 'ts_a' },
          { tilesetAssetId: 'ts_b' },
        ],
        sourceIndices: [1, 2, 0, 0],
        data: [1, 2, 0, 0],
      }),
    )
    expect(used.sort()).toEqual(['ts_a', 'ts_b'])
  })
})

describe('removeSourceFromLayer', () => {
  it('returns null when cells still use the source', () => {
    const l = layer({
      tilesetSources: [{ tilesetAssetId: 'ts_a' }],
      sourceIndices: [1, 0, 0, 0],
      data: [1, 0, 0, 0],
    })
    expect(layerSourceHasCells(l, 1)).toBe(true)
    expect(removeSourceFromLayer(l, 1)).toBeNull()
  })

  it('removes unused source and reindexes higher indices', () => {
    const l = layer({
      tilesetSources: [
        { tilesetAssetId: 'ts_a' },
        { tilesetAssetId: 'ts_b' },
      ],
      sourceIndices: [0, 2, 0, 0],
      data: [0, 1, 0, 0],
    })
    const next = removeSourceFromLayer(l, 1)
    expect(next?.tilesetSources).toEqual([{ tilesetAssetId: 'ts_b' }])
    expect(next?.sourceIndices).toEqual([0, 1, 0, 0])
  })
})
