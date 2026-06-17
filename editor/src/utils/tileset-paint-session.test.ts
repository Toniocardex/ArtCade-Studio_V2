import { describe, expect, it } from 'vitest'
import {
  canAssignTilesetToLayer,
  isPaintSessionAligned,
  layerHasPaintedCells,
  shouldClosePaintOnLayerSwitch,
} from './tileset-paint-session'
import type { TilemapLayer } from '../types/tilemap'

const emptyLayer: TilemapLayer = {
  tileSize: 32,
  cols: 4,
  rows: 4,
  data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  tilesetAssetId: 'ts_a',
}

describe('tileset-paint-session', () => {
  it('layerHasPaintedCells detects non-zero cells', () => {
    expect(layerHasPaintedCells(emptyLayer)).toBe(false)
    expect(layerHasPaintedCells({ ...emptyLayer, data: [1, ...emptyLayer.data.slice(1)] })).toBe(true)
  })

  it('canAssignTilesetToLayer blocks rebind when painted with another tileset', () => {
    expect(canAssignTilesetToLayer(undefined, 'ts_b')).toBe(true)
    expect(canAssignTilesetToLayer(emptyLayer, 'ts_a')).toBe(true)
    expect(canAssignTilesetToLayer(emptyLayer, 'ts_b')).toBe(true)
    expect(
      canAssignTilesetToLayer(
        { ...emptyLayer, data: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        'ts_b',
      ),
    ).toBe(false)
  })

  it('isPaintSessionAligned requires editing id to match layer binding', () => {
    const base = {
      project: {
        scenes: {
          s: {
            tilemapLayers: {
              Background: { ...emptyLayer, tilesetAssetId: 'ts_a' },
            },
          },
        },
      },
      selection: { sceneId: 's', entityId: null },
      editorActiveLayer: 'Background',
      editingTilesetId: 'ts_a',
    }
    expect(isPaintSessionAligned(base as never)).toBe(true)
    expect(isPaintSessionAligned({ ...base, editingTilesetId: 'ts_b' } as never)).toBe(false)
    expect(
      isPaintSessionAligned({
        ...base,
        project: { scenes: { s: { tilemapLayers: {} } } },
        editingTilesetId: 'ts_b',
      } as never),
    ).toBe(true)
  })

  it('shouldClosePaintOnLayerSwitch when target layer has different tileset', () => {
    const state = {
      project: {
        scenes: {
          s: {
            tilemapLayers: {
              Background: { ...emptyLayer, tilesetAssetId: 'ts_a' },
              Props: { ...emptyLayer, tilesetAssetId: 'ts_b' },
            },
          },
        },
      },
      selection: { sceneId: 's', entityId: null },
      editorActiveLayer: 'Background',
      editingTilesetId: 'ts_a',
    }
    expect(shouldClosePaintOnLayerSwitch(state as never, 'Props')).toBe(true)
    expect(shouldClosePaintOnLayerSwitch(state as never, 'Background')).toBe(false)
    expect(shouldClosePaintOnLayerSwitch(state as never, 'Effects')).toBe(false)
  })
})
