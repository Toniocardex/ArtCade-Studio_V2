import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import { parseProjectDoc, serializeProjectDoc } from '../utils/project'
import { DEFAULT_WORLD } from '../types'
import type { ProjectDoc } from '../types'

function project(): ProjectDoc {
  return {
    projectName: 'T', version: '2.0.0',
    gameResolution: { x: 1280, y: 720 }, targetFPS: 60,
    activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1, name: 'A', className: 'Player', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
    },
    scenes: {
      s: { id: 's', name: 'S', worldSize: { x: 1280, y: 720 }, viewportSize: { x: 1280, y: 720 }, backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1] },
    },
  }
}
function st(p: ProjectDoc): CoreState {
  return {
    project: p, projectPath: null, projectDirty: false,
    selection: { entityId: 1, sceneId: 's' },
    mode: 'canvas', bottomTab: 'assets',
    openScripts: [], activeScriptPath: null, isPlaying: false, selectedTileCell: 1,
  }
}

describe('coreReducer — hierarchy', () => {
  it('ENTITY_ADD creates an entity, adds to scene, selects it', () => {
    const s = coreReducer(st(project()), { type: 'ENTITY_ADD', sceneId: 's' })
    expect(Object.keys(s.project!.entities)).toHaveLength(2)
    expect(s.project!.entities[2]).toBeDefined()
    expect(s.project!.scenes.s.entityIds).toContain(2)
    expect(s.selection.entityId).toBe(2)
    expect(s.projectDirty).toBe(true)
  })

  it('ENTITY_DUPLICATE clones into a new id, offsets, selects it', () => {
    const s = coreReducer(st(project()), { type: 'ENTITY_DUPLICATE', entityId: 1, sceneId: 's' })
    expect(Object.keys(s.project!.entities)).toHaveLength(2)
    const dup = s.project!.entities[2]
    expect(dup).toBeDefined()
    expect(dup.id).toBe(2)
    expect(dup.name).toBe('A_Copy')
    expect(dup.className).toBe('Player')
    expect(dup.transform.position).toEqual({ x: 16, y: 16 })
    // deep clone — mutating the copy must not touch the source
    expect(s.project!.entities[1].transform.position).toEqual({ x: 0, y: 0 })
    expect(s.project!.scenes.s.entityIds).toEqual([1, 2])
    expect(s.selection.entityId).toBe(2)
    expect(s.projectDirty).toBe(true)
  })

  it('ENTITY_DELETE removes from entities + all scenes + deselects', () => {
    const s = coreReducer(st(project()), { type: 'ENTITY_DELETE', entityId: 1 })
    expect(s.project!.entities[1]).toBeUndefined()
    expect(s.project!.scenes.s.entityIds).not.toContain(1)
    expect(s.selection.entityId).toBeNull()
  })

  it('ENTITY_SET_NAME renames entity and marks dirty', () => {
    const s = coreReducer(st(project()), {
      type: 'ENTITY_SET_NAME', entityId: 1, name: 'Hero',
    })
    expect(s.project!.entities[1].name).toBe('Hero')
    expect(s.projectDirty).toBe(true)
  })

  it('ENTITY_SET_VISIBLE toggles visibility immutably', () => {
    const prev = coreReducer(st(project()), { type: 'ENTITY_SET_VISIBLE', entityId: 1, visible: false })
    expect(prev.project!.entities[1].visible).toBe(false)
    const next = coreReducer(prev, { type: 'ENTITY_SET_VISIBLE', entityId: 1, visible: true })
    expect(next.project!.entities[1].visible).toBe(true)
    expect(prev.project!.entities[1].visible).toBe(false) // immutability
  })

  it('WORLD_SET merges over defaults, marks dirty', () => {
    let s = coreReducer(st(project()), { type: 'WORLD_SET', patch: { gravity: 20 } })
    expect(s.project!.world).toEqual({ ...DEFAULT_WORLD, gravity: 20 })
    s = coreReducer(s, { type: 'WORLD_SET', patch: { timeScale: 0.5 } })
    expect(s.project!.world).toEqual({ ...DEFAULT_WORLD, gravity: 20, timeScale: 0.5 })
    expect(s.projectDirty).toBe(true)
  })

  it('actions are no-ops without project / unknown entity', () => {
    const noProj = { ...st(project()), project: null }
    expect(coreReducer(noProj, { type: 'ENTITY_ADD', sceneId: 's' }).projectDirty).toBe(false)
    expect(
      coreReducer(st(project()), { type: 'ENTITY_DELETE', entityId: 99 }).projectDirty,
    ).toBe(false)
  })
})

describe('project.json roundtrip — world + visible', () => {
  it('persists world and visible:false, omits when default/absent', () => {
    let s = coreReducer(st(project()), { type: 'WORLD_SET', patch: { gravity: 15 } })
    s = coreReducer(s, { type: 'ENTITY_SET_VISIBLE', entityId: 1, visible: false })
    const json = serializeProjectDoc(s.project!)
    expect(json).toContain('"world"')
    expect(json).toContain('"visible"')
    const again = parseProjectDoc(json)!
    expect(again.world!.gravity).toBe(15)
    expect(again.entities[1].visible).toBe(false)

    // baseline project: no world, visible omitted (default true)
    const plain = serializeProjectDoc(project())
    expect(plain).not.toContain('"world"')
    expect(plain).not.toContain('"visible"')
  })
})
