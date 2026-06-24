import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import { parseProjectDoc, serializeProjectDoc } from '../utils/project'
import { DEFAULT_EDITOR_ACTIVE_LAYER } from '../constants/scene-layers'
import type { ProjectDoc, TilesetAsset } from '../types'

const TS: TilesetAsset = {
  assetId: 'ts_a', name: 'Forest', spriteImagePath: 'forest.png',
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
    openScripts: [], activeScriptPath: null, isPlaying: false,
    selectedTileCell: 1,
    editorActiveLayer: DEFAULT_EDITOR_ACTIVE_LAYER,
    editorGridSize: 32, snapToGrid: false, editorZoom: 1.0, editorZoomMode: 'manual', cameraPreview: false,
    projectLoadEpoch: 0,
    authoringMode: 'base',
  } as CoreState
}

describe('coreReducer — tileset (Phase F1)', () => {
  it('TILESET_ASSET_ADD stores the asset, marks dirty', () => {
    const s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    expect(s.project!.tilesets!['ts_a']).toEqual(TS)
    expect(s.projectDirty).toBe(true)
  })

  it('TILESET_ASSET_RENAME changes only the display name', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILESET_ASSET_RENAME', assetId: 'ts_a', name: 'Forest Main' })

    expect(s.project!.tilesets!.ts_a).toMatchObject({
      assetId: 'ts_a',
      name: 'Forest Main',
      spriteImagePath: 'forest.png',
    })
  })

  it('TILEMAP_SET_TILESETID sets default brush on active layer', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILEMAP_SET_TILESETID', sceneId: 's', assetId: 'ts_a' })
    const layer = s.project!.scenes.s.tilemapLayers?.[DEFAULT_EDITOR_ACTIVE_LAYER]
    expect(layer?.defaultTilesetAssetId).toBe('ts_a')
    expect(layer?.cols).toBeGreaterThan(0)
  })

  it('TILESET_ASSET_REMOVE deletes asset and scrubs layer sources', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILESET_PAINT_BEGIN', tilesetId: 'ts_a' })
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 0,
      row: 0,
      tileId: 3,
      tilesetAssetId: 'ts_a',
    })
    s = coreReducer(s, { type: 'TILESET_ASSET_REMOVE', assetId: 'ts_a' })
    expect(s.project!.tilesets).toEqual({})
    const layer = s.project!.scenes.s.tilemapLayers?.[DEFAULT_EDITOR_ACTIVE_LAYER]
    expect(layer?.data[0]).toBe(0)
    expect(layer?.sourceIndices?.[0]).toBe(0)
  })

  it('TILESET_PAINT_BEGIN opens palette and resets brush', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILESET_SELECT_CELL', cellIndex: 7 })
    s = coreReducer(s, { type: 'TILESET_PAINT_BEGIN', tilesetId: 'ts_a' })
    expect(s.activePaintTilesetId).toBe('ts_a')
    expect(s.tilePaletteOpen).toBe(true)
    expect(s.selectedTileCell).toBe(1)
    expect(s.recentPaintTilesetIds[0]).toBe('ts_a')
  })

  it('TILEMAP_PAINT_CELL supports two tilesets on the same layer', () => {
    const TS_B: TilesetAsset = { ...TS, assetId: 'ts_b', name: 'City' }
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILESET_ASSET_ADD', asset: TS_B })
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 0,
      row: 0,
      tileId: 1,
      tilesetAssetId: 'ts_a',
    })
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 1,
      row: 0,
      tileId: 2,
      tilesetAssetId: 'ts_b',
    })
    const layer = s.project!.scenes.s.tilemapLayers?.[DEFAULT_EDITOR_ACTIVE_LAYER]!
    expect(layer.data[0]).toBe(1)
    expect(layer.data[1]).toBe(2)
    expect(layer.sourceIndices?.[0]).toBe(1)
    expect(layer.sourceIndices?.[1]).toBe(2)
    expect(layer.tilesetSources?.map((x) => x.tilesetAssetId)).toEqual(['ts_a', 'ts_b'])
  })

  it('TILEMAP_PAINT_CELL shows notice when a new source is added to the layer', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 0,
      row: 0,
      tileId: 1,
      tilesetAssetId: 'ts_a',
    })
    expect(s.paintSourceNotice).toBe('Forest added to Background sources')
  })

  it('SET_EDITOR_ACTIVE_LAYER remembers brush per layer', () => {
    const TS_B: TilesetAsset = { ...TS, assetId: 'ts_b', name: 'City' }
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILESET_ASSET_ADD', asset: TS_B })
    s = coreReducer(s, { type: 'TILESET_PAINT_BEGIN', tilesetId: 'ts_a' })
    s = coreReducer(s, { type: 'SET_EDITOR_ACTIVE_LAYER', layerName: 'Props' })
    expect(s.activePaintTilesetId).toBe('ts_a')
    expect(s.lastPaintTilesetByLayer[DEFAULT_EDITOR_ACTIVE_LAYER]).toBe('ts_a')
    s = coreReducer(s, { type: 'TILESET_PAINT_BEGIN', tilesetId: 'ts_b' })
    s = coreReducer(s, { type: 'SET_EDITOR_ACTIVE_LAYER', layerName: DEFAULT_EDITOR_ACTIVE_LAYER })
    expect(s.activePaintTilesetId).toBe('ts_a')
  })
})

describe('project.json roundtrip — tilesets', () => {
  it('serialize → parse preserves tilemapLayers sources', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 0,
      row: 0,
      tileId: 2,
      tilesetAssetId: 'ts_a',
    })

    const json = serializeProjectDoc(s.project!)
    expect(json).toContain('"tilemapLayers"')
    expect(json).toContain('"tilesetSources"')
    expect(json).toContain('"sourceIndices"')
    const again = parseProjectDoc(json)!
    const layer = again.scenes.s.tilemapLayers?.[DEFAULT_EDITOR_ACTIVE_LAYER]
    expect(layer?.tilesetSources?.[0]?.tilesetAssetId).toBe('ts_a')
    expect(layer?.sourceIndices?.[0]).toBe(1)
    expect(layer?.data[0]).toBe(2)
  })
})
