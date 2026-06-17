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
    consoleAckUpToId: 0, editingTilesetId: null,
    openScripts: [], activeScriptPath: null, isPlaying: false,
    selectedTileCell: 1,
    editorActiveLayer: DEFAULT_EDITOR_ACTIVE_LAYER,
    editorGridSize: 32, snapToGrid: false, editorZoom: 1.0, editorZoomMode: 'manual', cameraPreview: false,
    projectLoadEpoch: 0,
    authoringMode: 'base',
  }
}

describe('coreReducer — tileset (Phase F1)', () => {
  it('TILESET_ASSET_ADD stores the asset, marks dirty', () => {
    const s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    expect(s.project!.tilesets!['ts_a']).toEqual(TS)
    expect(s.projectDirty).toBe(true)
  })

  it('TILESET_ASSET_ADD with same id replaces (grid re-derive)', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILESET_ASSET_ADD', asset: { ...TS, tileSize: 16, cols: 16, rows: 8 } })
    expect(Object.keys(s.project!.tilesets!)).toHaveLength(1)
    expect(s.project!.tilesets!['ts_a'].tileSize).toBe(16)
  })

  it('TILEMAP_SET_TILESETID attaches to the scene (creates tilemap)', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILEMAP_SET_TILESETID', sceneId: 's', assetId: 'ts_a' })
    expect(s.project!.scenes.s.tilemap!.tilesetAssetId).toBe('ts_a')
    expect(s.project!.scenes.s.tilemap!.cols).toBeGreaterThan(0)
  })

  it('TILESET_ASSET_REMOVE deletes asset + detaches from scenes', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILEMAP_SET_TILESETID', sceneId: 's', assetId: 'ts_a' })
    const prevTm = s.project!.scenes.s.tilemap
    s = coreReducer(s, { type: 'TILESET_ASSET_REMOVE', assetId: 'ts_a' })
    expect(s.project!.tilesets).toEqual({})
    expect(s.project!.scenes.s.tilemap!.tilesetAssetId).toBeUndefined()
    expect(prevTm!.tilesetAssetId).toBe('ts_a') // immutability
  })

  it('TILESET_SELECT_CELL is UI-only (no dirty), clamps >=0', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_SELECT_CELL', cellIndex: 5 })
    expect(s.selectedTileCell).toBe(5)
    expect(s.projectDirty).toBe(false)
    s = coreReducer(s, { type: 'TILESET_SELECT_CELL', cellIndex: -3 })
    expect(s.selectedTileCell).toBe(0)
  })

  it('TILESET_EDIT_OPEN resets brush and assigns tileset to active layer', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILESET_SELECT_CELL', cellIndex: 7 })
    s = coreReducer(s, { type: 'TILESET_EDIT_OPEN', tilesetId: 'ts_a' })
    expect(s.editingTilesetId).toBe('ts_a')
    expect(s.selectedTileCell).toBe(1)
    expect(s.project!.scenes.s.tilemapLayers?.[DEFAULT_EDITOR_ACTIVE_LAYER]?.tilesetAssetId).toBe('ts_a')
  })

  it('TILESET_EDIT_OPEN does not rebind layer with painted cells to another tileset', () => {
    const TS_B: TilesetAsset = { ...TS, assetId: 'ts_b', name: 'City' }
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILESET_ASSET_ADD', asset: TS_B })
    s = coreReducer(s, { type: 'TILESET_EDIT_OPEN', tilesetId: 'ts_a' })
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 0,
      row: 0,
      tileId: 3,
    })
    s = coreReducer(s, { type: 'TILESET_EDIT_OPEN', tilesetId: 'ts_b' })
    expect(s.editingTilesetId).toBe('ts_b')
    expect(s.project!.scenes.s.tilemapLayers?.[DEFAULT_EDITOR_ACTIVE_LAYER]?.tilesetAssetId).toBe('ts_a')
  })

  it('SET_EDITOR_ACTIVE_LAYER closes paint when target layer has a different tileset', () => {
    const TS_B: TilesetAsset = { ...TS, assetId: 'ts_b', name: 'City' }
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILESET_ASSET_ADD', asset: TS_B })
    s = coreReducer(s, { type: 'TILESET_EDIT_OPEN', tilesetId: 'ts_a' })
    s = coreReducer(s, {
      type: 'TILEMAP_PAINT_CELL',
      sceneId: 's',
      col: 0,
      row: 0,
      tileId: 1,
    })
    s = {
      ...s,
      project: {
        ...s.project!,
        scenes: {
          ...s.project!.scenes,
          s: {
            ...s.project!.scenes.s,
            tilemapLayers: {
              ...s.project!.scenes.s.tilemapLayers,
              Props: {
                tileSize: 32,
                cols: 8,
                rows: 4,
                data: new Array(32).fill(0),
                tilesetAssetId: 'ts_b',
              },
            },
          },
        },
      },
    }
    s = coreReducer(s, { type: 'SET_EDITOR_ACTIVE_LAYER', layerName: 'Props' })
    expect(s.editingTilesetId).toBeNull()
    expect(s.editorActiveLayer).toBe('Props')
  })

  it('no-op without a project', () => {
    const s = coreReducer({ ...st(project()), project: null },
      { type: 'TILESET_ASSET_ADD', asset: TS })
    expect(s.project).toBeNull()
    expect(s.projectDirty).toBe(false)
  })
})

describe('project.json roundtrip — tilesets (Phase F1)', () => {
  it('serialize → parse preserves tilesets + tilemap.tilesetAssetId', () => {
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: TS })
    s = coreReducer(s, { type: 'TILEMAP_SET_TILESETID', sceneId: 's', assetId: 'ts_a' })

    const json = serializeProjectDoc(s.project!)
    expect(json).toContain('"tilesets"')
    expect(json).toContain('"tilesetAssetId"')
    const again = parseProjectDoc(json)!
    expect(again.tilesets!['ts_a']).toEqual(TS)
    expect(again.scenes.s.tilemap!.tilesetAssetId).toBe('ts_a')
  })

  it('drops transient previewDataUrl on serialize', () => {
    const withPreview: TilesetAsset = {
      ...TS,
      spriteImagePath: 'assets/tilesets/forest.png',
      previewDataUrl: 'data:image/png;base64,AA==',
    }
    let s = coreReducer(st(project()), { type: 'TILESET_ASSET_ADD', asset: withPreview })
    const json = serializeProjectDoc(s.project!)
    expect(json).not.toContain('previewDataUrl')
    expect(parseProjectDoc(json)!.tilesets!['ts_a'].previewDataUrl).toBeUndefined()
  })

  it('omits tilesets when absent (byte-identical for projects without them)', () => {
    const plain = serializeProjectDoc(project())
    expect(plain).not.toContain('"tilesets"')
    expect(plain).not.toContain('"tilesetAssetId"')
  })

  it('parseTilesets is defensive (skips non-objects, keeps valid)', () => {
    const raw = JSON.stringify({
      projectName: 'D', version: '2.0.0',
      targetFPS: 60, activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
      entities: {}, scenes: { s: { id: 's', name: 'S', entityIds: [] } },
      tilesets: { bad: 'nope', ok: { assetId: 'ok', name: 'OK', spriteImagePath: 'a.png', tileSize: 16, margin: 1, cols: 4, rows: 2 } },
    })
    const p = parseProjectDoc(raw)!
    expect(p.tilesets!['ok'].tileSize).toBe(16)
    expect(p.tilesets!['bad']).toBeUndefined()
  })
})
