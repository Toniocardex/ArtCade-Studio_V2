import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import { parseProjectDoc, serializeProjectDoc } from '../utils/project'
import { createTilemap, DEFAULT_TILE_PALETTE, resizeTilemap, resizeTilemapForTileSize } from '../types'
import type { ProjectDoc, TilesetAsset } from '../types'
import { DEFAULT_EDITOR_ACTIVE_LAYER } from '../constants/scene-layers'

const TS: TilesetAsset = {
  assetId: 'ts_paint', name: 'Paint', spriteImagePath: 'p.png',
  tileSize: 32, margin: 0, cols: 8, rows: 4,
}

function project(): ProjectDoc {
  return {
    projectName: 'T', version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: {
      s: { id: 's', name: 'S', worldSize: { x: 640, y: 320 }, viewportSize: { x: 640, y: 320 }, backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [] },
    },
  }
}
function st(p: ProjectDoc): CoreState {
  return {
    project: p, projectPath: null, projectDirty: false,
    selection: { entityId: null, sceneId: 's' },
    mode: 'canvas', consoleOpen: false, bottomPanelCollapsed: true,
    dockPanelVisibility: { console: true, timeline: false, events: false },
    consoleAckUpToId: 0,
    activePaintTilesetId: null,
    tilePaletteOpen: false,
    lastPaintTilesetByLayer: {},
    recentPaintTilesetIds: [],
    paintSourceNotice: null,
    openScripts: [], activeScriptPath: null, isPlaying: false, selectedTileCell: 1,
    editorGridSize: 32, snapToGrid: false, editorZoom: 1.0, editorZoomMode: 'manual', cameraPreview: false,
    projectLoadEpoch: 0,
    authoringMode: 'base',
    editorActiveLayer: DEFAULT_EDITOR_ACTIVE_LAYER,
  }
}

describe('createTilemap', () => {
  it('sizes to world / tileSize, clamped, all empty', () => {
    const tm = createTilemap(640, 320, 32) // 20 x 10
    expect(tm.cols).toBe(20)
    expect(tm.rows).toBe(10)
    expect(tm.data).toHaveLength(200)
    expect(tm.data.every(v => v === 0)).toBe(true)
  })
  it('clamps tiny / huge worlds', () => {
    expect(createTilemap(50, 50, 32).cols).toBe(8)      // min 8
    expect(createTilemap(9999, 9999, 32).cols).toBe(64) // max 64
  })
})

describe('resizeTilemap', () => {
  it('preserves overlapping cells and pads new cells as empty', () => {
    const tm = createTilemap(640, 320, 32)
    tm.data[2 * tm.cols + 3] = 7

    const bigger = resizeTilemap(tm, 1280, 640)
    expect(bigger.cols).toBe(40)
    expect(bigger.rows).toBe(20)
    expect(bigger.data[2 * bigger.cols + 3]).toBe(7)
    expect(bigger.data[bigger.data.length - 1]).toBe(0)

    const smaller = resizeTilemap(bigger, 320, 192)
    expect(smaller.cols).toBe(10)
    expect(smaller.rows).toBe(6)
    expect(smaller.data[2 * smaller.cols + 3]).toBe(7)
  })
})

describe('resizeTilemapForTileSize', () => {
  it('preserves sourceIndices on overlapping cells when tileSize changes', () => {
    const tm = createTilemap(640, 320, 32)
    tm.tilesetSources = [{ tilesetAssetId: 'ts_a' }, { tilesetAssetId: 'ts_b' }]
    tm.sourceIndices = new Array(tm.cols * tm.rows).fill(0)
    tm.data[5] = 3
    tm.sourceIndices[5] = 2

    const resized = resizeTilemapForTileSize(tm, 640, 320, 16)
    expect(resized.tileSize).toBe(16)
    expect(resized.cols).toBeGreaterThan(tm.cols)
    expect(resized.sourceIndices).toBeDefined()
    expect(resized.sourceIndices![5]).toBe(2)
    expect(resized.data[5]).toBe(3)
  })
})

describe('coreReducer — tilemap', () => {
  it('TILEMAP_PAINT_CELL on new layer inherits 16px tileSize from paint tileset', () => {
    const TS16: TilesetAsset = {
      ...TS,
      assetId: 'ts_16',
      tileSize: 16,
    }
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS16 })
    s = {
      ...s,
      project: {
        ...s.project!,
        layers: [{ name: 'new_layer' }, { name: 'Background' }],
        scenes: {
          s: {
            ...s.project!.scenes.s,
            worldSize: { x: 1280, y: 640 },
            viewportSize: { x: 1280, y: 640 },
            tilemapLayers: {
              Background: {
                tileSize: 16,
                cols: 80,
                rows: 40,
                data: new Array(3200).fill(0),
              },
            },
          },
        },
      },
      editorActiveLayer: 'new_layer',
    }
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 10,
      row: 5,
      tileId: 3,
      tilesetAssetId: 'ts_16',
    })
    const layer = s.project!.scenes.s.tilemapLayers!.new_layer!
    expect(layer.tileSize).toBe(16)
    expect(layer.cols).toBe(80)
    expect(layer.rows).toBe(40)
    expect(layer.data[5 * 80 + 10]).toBe(3)
  })

  it('TILEMAP_SET_TILESIZE preserves sourceIndices on overlapping cells', () => {
    const p: ProjectDoc = {
      ...project(),
      layers: [{ name: 'Background' }],
      scenes: {
        s: {
          ...project().scenes.s,
          tilemapLayers: {
            Background: {
              tileSize: 32,
              cols: 20,
              rows: 10,
              data: new Array(200).fill(0),
              tilesetSources: [{ tilesetAssetId: 'ts_paint' }],
              sourceIndices: new Array(200).fill(0),
            },
          },
        },
      },
    }
    p.scenes.s.tilemapLayers!.Background!.data[5] = 4
    p.scenes.s.tilemapLayers!.Background!.sourceIndices![5] = 1

    const resized = coreReducer(st(p), {
      type: 'TILEMAP_SET_TILESIZE',
      sceneId: 's',
      tileSize: 16,
    })
    const layer = resized.project!.scenes.s.tilemapLayers!.Background!
    expect(layer.tileSize).toBe(16)
    expect(layer.cols).toBeGreaterThan(20)
    expect(layer.sourceIndices).toBeDefined()
    expect(layer.data[5]).toBe(4)
    expect(layer.sourceIndices![5]).toBe(1)
    expect(resized.projectDirty).toBe(true)
  })

  it('TILEMAP_INIT creates an empty layer sized to the scene', () => {
    const s = coreReducer(st(project()), { type: 'TILEMAP_INIT', sceneId: 's' })
    const tm = s.project!.scenes.s.tilemap!
    expect(tm.cols).toBe(20)
    expect(tm.rows).toBe(10)
    expect(s.projectDirty).toBe(true)
  })

  it('TILEMAP_PAINT auto-creates the layer then sets the cell', () => {
    let s = coreReducer(st(project()), { type: 'TILEMAP_PAINT', sceneId: 's', index: 5, tileId: 2 })
    expect(s.project!.scenes.s.tilemap!.data[5]).toBe(2)
    // erase = tileId 0
    s = coreReducer(s, { type: 'TILEMAP_PAINT', sceneId: 's', index: 5, tileId: 0 })
    expect(s.project!.scenes.s.tilemap!.data[5]).toBe(0)
  })

  it('TILEMAP_PAINT is immutable and ignores out-of-range', () => {
    const a = coreReducer(st(project()), { type: 'TILEMAP_PAINT', sceneId: 's', index: 0, tileId: 1 })
    const b = coreReducer(a, { type: 'TILEMAP_PAINT', sceneId: 's', index: 99999, tileId: 1 })
    expect(b).toBe(a) // out of range → unchanged reference
    const c = coreReducer(a, { type: 'TILEMAP_PAINT', sceneId: 's', index: 1, tileId: 3 })
    expect(a.project!.scenes.s.tilemap!.data[1]).toBe(0) // original untouched
    expect(c.project!.scenes.s.tilemap!.data[1]).toBe(3)
  })

  it('TILEMAP_PAINT_CELL resolves (col,row)→index via layer cols (F2)', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILEMAP_INIT', sceneId: 's' })
    const cols = s.project!.scenes.s.tilemap!.cols
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 3,
      row: 2,
      tileId: 7,
      tilesetAssetId: 'ts_paint',
    })
    expect(s.project!.scenes.s.tilemap!.data[2 * cols + 3]).toBe(7)
    expect(s.projectDirty).toBe(true)
    const same = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 9999,
      row: 0,
      tileId: 7,
      tilesetAssetId: 'ts_paint',
    })
    expect(same).toBe(s)
    let noTm = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    noTm = coreReducer(noTm, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 0,
      row: 0,
      tileId: 1,
      tilesetAssetId: 'ts_paint',
    })
    expect(noTm.projectDirty).toBe(true)
    expect(noTm.project!.scenes.s.tilemapLayers?.[DEFAULT_EDITOR_ACTIVE_LAYER]?.data[0]).toBe(1)
    expect(noTm.project!.scenes.s.tilemap!.data[0]).toBe(1)
  })

  it('no-op without project / unknown scene', () => {
    expect(
      coreReducer(st(project()), { type: 'TILEMAP_PAINT', sceneId: 'nope', index: 0, tileId: 1 }).projectDirty,
    ).toBe(false)
  })

  it('SCENE_SET_WORLD_SIZE resizes an existing tilemap and marks dirty', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILEMAP_INIT', sceneId: 's' })
    const prevCols = s.project!.scenes.s.tilemap!.cols
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 3,
      row: 2,
      tileId: 4,
      tilesetAssetId: 'ts_paint',
    })

    const resized = coreReducer(s, {
      type: 'SCENE_SET_WORLD_SIZE',
      sceneId: 's',
      x: 1280,
      y: 640,
    })
    const tm = resized.project!.scenes.s.tilemap!
    expect(resized.project!.scenes.s.worldSize).toEqual({ x: 1280, y: 640 })
    expect(tm.cols).toBeGreaterThan(prevCols)
    expect(tm.data[2 * tm.cols + 3]).toBe(4)
    expect(resized.projectDirty).toBe(true)
  })

  it('EDITOR_SET_GRID_SIZE updates editor-only state without creating tilemap', () => {
    const s = coreReducer(st(project()), {
      type: 'EDITOR_SET_GRID_SIZE',
      tileSize: 64,
    })
    expect(s.editorGridSize).toBe(64)
    expect(s.project!.scenes.s.tilemap).toBeUndefined()
    expect(s.projectDirty).toBe(false)
  })

  it('SET_SNAP_TO_GRID updates editor-only state without dirtying project', () => {
    const s = coreReducer(st(project()), { type: 'SET_SNAP_TO_GRID', enabled: true })
    expect(s.snapToGrid).toBe(true)
    expect(s.projectDirty).toBe(false)
  })
})

describe('project.json roundtrip — tilemap + palette', () => {
  it('persists tilemap & palette, omits when absent', () => {
    let s = coreReducer(st(project()), { type: 'TILEMAP_PAINT', sceneId: 's', index: 3, tileId: 2 })
    s = { ...s, project: { ...s.project!, tilePalette: DEFAULT_TILE_PALETTE } }

    const json = serializeProjectDoc(s.project!)
    expect(json).toContain('"tilemap"')
    expect(json).toContain('"tilePalette"')
    const again = parseProjectDoc(json)!
    expect(again.scenes.s.tilemap!.data[3]).toBe(2)
    expect(again.tilePalette!.length).toBe(DEFAULT_TILE_PALETTE.length)

    const plain = serializeProjectDoc(project())
    expect(plain).not.toContain('"tilemap"')
    expect(plain).not.toContain('"tilePalette"')
  })

  it('parseTilemap repairs a wrong-length data array defensively', () => {
    const raw = JSON.stringify({
      projectName: 'D', version: '2.0.0',
      targetFPS: 60, activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
      entities: {},
      scenes: { s: { id: 's', name: 'S', worldSize: [320, 320], entityIds: [],
        tilemap: { tileSize: 32, cols: 4, rows: 4, data: [1, 2, 3] } } },
    })
    const p = parseProjectDoc(raw)!
    const tm = p.scenes.s.tilemap!
    expect(tm.data).toHaveLength(16)          // cols*rows
    expect(tm.data.slice(0, 3)).toEqual([1, 2, 3])
    expect(tm.data[15]).toBe(0)               // padded
  })
})
