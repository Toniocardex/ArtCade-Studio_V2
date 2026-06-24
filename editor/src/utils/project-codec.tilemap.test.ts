import { describe, expect, it } from 'vitest'
import { parseProjectDoc, serializeProjectDoc } from './project'
import { DEFAULT_EDITOR_ACTIVE_LAYER_ID } from '../constants/scene-layers'

const BASE = {
  projectName: 'TilemapCodec',
  version: '2.0.0',
  targetFPS: 60,
  activeSceneId: 's',
  mainScriptPath: 'scripts/main.lua',
  entities: {},
  layers: [{ id: DEFAULT_EDITOR_ACTIVE_LAYER_ID, name: 'Background' }],
} as const

describe('project-codec tilemap round-trip', () => {
  it('migrates legacy tilesetAssetId layer to tilesetSources on serialize', () => {
    const raw = {
      ...BASE,
      scenes: {
        s: {
          id: 's',
          name: 'S',
          worldSize: [640, 320],
          viewportSize: [640, 320],
          backgroundColor: [0, 0, 0, 1],
          entityIds: [],
          tilemapLayers: {
            [DEFAULT_EDITOR_ACTIVE_LAYER_ID]: {
              tileSize: 32,
              cols: 4,
              rows: 4,
              tilesetAssetId: 'ts_legacy',
              data: [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          },
        },
      },
    }

    const parsed = parseProjectDoc(JSON.stringify(raw))!
    const layer = parsed.scenes.s.tilemapLayers![DEFAULT_EDITOR_ACTIVE_LAYER_ID]!
    expect(layer.tilesetAssetId).toBe('ts_legacy')
    expect(layer.data[0]).toBe(1)
    expect(layer.data[2]).toBe(2)

    const json = serializeProjectDoc(parsed)
    expect(json).toContain('"tilesetSources"')

    const again = parseProjectDoc(json)!
    const saved = again.scenes.s.tilemapLayers![DEFAULT_EDITOR_ACTIVE_LAYER_ID]!
    expect(saved.tilesetAssetId).toBeUndefined()
    expect(saved.tilesetSources).toEqual([{ tilesetAssetId: 'ts_legacy' }])
    expect(saved.sourceIndices).toHaveLength(16)
    expect(saved.sourceIndices![0]).toBe(1)
    expect(saved.sourceIndices![2]).toBe(1)
    expect(saved.sourceIndices![1]).toBe(0)
    expect(saved.data).toEqual(layer.data)
  })

  it('preserves multi-source tilemapLayers through serialize round-trip', () => {
    const raw = {
      ...BASE,
      scenes: {
        s: {
          id: 's',
          name: 'S',
          worldSize: [640, 320],
          viewportSize: [640, 320],
          backgroundColor: [0, 0, 0, 1],
          entityIds: [],
          tilemapLayers: {
            [DEFAULT_EDITOR_ACTIVE_LAYER_ID]: {
              tileSize: 32,
              cols: 4,
              rows: 4,
              tilesetSources: [
                { tilesetAssetId: 'ts_a' },
                { tilesetAssetId: 'ts_b' },
              ],
              sourceIndices: [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              data: [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          },
        },
      },
    }

    const parsed = parseProjectDoc(JSON.stringify(raw))!
    const json = serializeProjectDoc(parsed)
    const again = parseProjectDoc(json)!
    const before = parsed.scenes.s.tilemapLayers![DEFAULT_EDITOR_ACTIVE_LAYER_ID]!
    const after = again.scenes.s.tilemapLayers![DEFAULT_EDITOR_ACTIVE_LAYER_ID]!

    expect(after.tilesetSources).toEqual(before.tilesetSources)
    expect(after.sourceIndices).toEqual(before.sourceIndices)
    expect(after.data).toEqual(before.data)
    expect(after.tileSize).toBe(32)
    expect(after.cols).toBe(4)
    expect(after.rows).toBe(4)
  })
})
