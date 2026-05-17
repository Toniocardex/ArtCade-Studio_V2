import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import { parseProjectDoc, serializeProjectDoc } from '../utils/project'
import { createTilemap, DEFAULT_TILE_PALETTE } from '../types'
import type { ProjectDoc } from '../types'

function project(): ProjectDoc {
  return {
    projectName: 'T', version: '2.0.0',
    gameResolution: { x: 1280, y: 720 }, targetFPS: 60,
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
    view: 'scene', bottomTab: 'tileset',
    openScripts: [], activeScriptPath: null, isPlaying: false,
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

describe('coreReducer — tilemap', () => {
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

  it('no-op without project / unknown scene', () => {
    expect(
      coreReducer(st(project()), { type: 'TILEMAP_PAINT', sceneId: 'nope', index: 0, tileId: 1 }).projectDirty,
    ).toBe(false)
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
      projectName: 'D', version: '2.0.0', gameResolution: [1280, 720],
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
