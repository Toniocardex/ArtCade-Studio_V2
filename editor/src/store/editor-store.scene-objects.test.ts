import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import { parseProjectDoc, serializeProjectDoc } from '../utils/project'
import { collectProjectDiagnostics, projectDiagnosticsErrors } from '../utils/project-validator'
import { createLogicBoardForObjectType } from '../utils/logic-board/factory'
import { DEFAULT_WORLD } from '../types'
import type { ProjectDoc } from '../types'

function project(): ProjectDoc {
  return {
    projectName: 'T', version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1, name: 'A', className: 'Player', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
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
    mode: 'canvas', consoleOpen: false, bottomPanelCollapsed: true,
    dockPanelVisibility: { console: true, timeline: false, logic: true, events: false },
    consoleAckUpToId: 0, editingTilesetId: null,
    openScripts: [], activeScriptPath: null, isPlaying: false, selectedTileCell: 1,
    editorGridSize: 32, snapToGrid: false, editorZoom: 1.0, editorZoomMode: 'manual', cameraPreview: false,
    projectLoadEpoch: 0,
    authoringMode: 'base',
  }
}

describe('coreReducer — scenes & objects', () => {
  it('ENTITY_ADD creates an entity, adds to scene, selects it', () => {
    const s = coreReducer(st(project()), { type: 'ENTITY_ADD', sceneId: 's' })
    expect(Object.keys(s.project!.entities)).toHaveLength(2)
    expect(s.project!.entities[2]).toBeDefined()
    expect(s.project!.entities[2].transform.position).toEqual({ x: 640, y: 360 })
    expect(s.project!.scenes.s.entityIds).toContain(2)
    expect(s.project!.objectTypes?.Player).toBeDefined()
    expect(s.project!.objectTypes?.Entity_2).toBeDefined()
    expect(s.project!.scenes.s.instances?.some((i) => i.id === 2)).toBe(true)
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

  it('ENTITY_ADD syncs objectTypes so logic boards targeting the type validate', () => {
    const blank = parseProjectDoc(serializeProjectDoc({
      projectName: 'T',
      version: '2.0.0',
      targetFPS: 60,
      activeSceneId: 's',
      mainScriptPath: 'scripts/main.lua',
      entities: {},
      scenes: {
        s: {
          id: 's',
          name: 'S',
          worldSize: { x: 1280, y: 720 },
          viewportSize: { x: 1280, y: 720 },
          backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
          entityIds: [],
        },
      },
      world: { ...DEFAULT_WORLD },
    }))!
    let s = st(blank)
    s = coreReducer(s, { type: 'ENTITY_ADD', sceneId: 's' })
    const typeId = 'Entity_1'
    expect(s.project!.objectTypes?.[typeId]).toBeDefined()
    s = coreReducer(s, {
      type: 'LOGIC_ADD_BOARD',
      board: createLogicBoardForObjectType(typeId, 'board_test'),
    })
    const errors = projectDiagnosticsErrors(collectProjectDiagnostics(s.project!))
    expect(errors.some((e) => e.message.includes('unknown object type'))).toBe(false)
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

  it('scene size and viewport updates mark the project dirty', () => {
    let s = coreReducer(st(project()), {
      type: 'SCENE_SET_WORLD_SIZE', sceneId: 's', x: 1600, y: 900,
    })
    expect(s.project!.scenes.s.worldSize).toEqual({ x: 1600, y: 900 })
    expect(s.projectDirty).toBe(true)

    s = coreReducer({ ...s, projectDirty: false }, {
      type: 'SCENE_SET_VIEWPORT_SIZE', sceneId: 's', x: 800, y: 450,
    })
    expect(s.project!.scenes.s.viewportSize).toEqual({ x: 800, y: 450 })
    expect(s.projectDirty).toBe(true)
  })

  it('SCENE_SET_WORLD_SIZE scales scene entity positions into the resized canvas', () => {
    const p = project()
    p.entities[1].transform.position = { x: 640, y: 360 }

    const s = coreReducer(st(p), {
      type: 'SCENE_SET_WORLD_SIZE', sceneId: 's', x: 640, y: 360,
    })

    expect(s.project!.entities[1].transform.position).toEqual({ x: 320, y: 180 })
    expect(s.project!.scenes.s.worldSize).toEqual({ x: 640, y: 360 })
    expect(s.projectDirty).toBe(true)
  })

  it('SCENE_SET_WORLD_SIZE keeps resized entities inside a small canvas inset', () => {
    const p = project()
    p.entities[1].transform.position = { x: 1280, y: 720 }

    const s = coreReducer(st(p), {
      type: 'SCENE_SET_WORLD_SIZE', sceneId: 's', x: 64, y: 64,
    })

    expect(s.project!.entities[1].transform.position).toEqual({ x: 32, y: 32 })
  })

  it('SCENE_ADD_EMPTY creates an inherited empty scene and selects it', () => {
    const s = coreReducer(st(project()), { type: 'SCENE_ADD_EMPTY', sourceSceneId: 's' })
    expect(s.project!.scenes.scene_2).toBeDefined()
    expect(s.project!.scenes.scene_2.name).toBe('Scene 2')
    expect(s.project!.scenes.scene_2.entityIds).toEqual([])
    expect(s.project!.scenes.scene_2.worldSize).toEqual({ x: 1280, y: 720 })
    expect(s.project!.activeSceneId).toBe('s')
    expect(s.selection).toEqual({ sceneId: 'scene_2', entityId: null })
    expect(s.projectDirty).toBe(true)
  })

  it('SCENE_RENAME keeps visible scene names unique', () => {
    const p = {
      ...project(),
      scenes: {
        ...project().scenes,
        scene_2: {
          id: 'scene_2', name: 'Menu',
          worldSize: { x: 1280, y: 720 },
          viewportSize: { x: 1280, y: 720 },
          backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
          entityIds: [],
        },
      },
    }
    const s = coreReducer(st(p), { type: 'SCENE_RENAME', sceneId: 'scene_2', name: 'S' })
    expect(s.project!.scenes.scene_2.name).toBe('S 2')
    expect(s.projectDirty).toBe(true)
  })

  it('SCENE_SET_START changes the start scene without changing editor selection', () => {
    const added = coreReducer(st(project()), { type: 'SCENE_ADD_EMPTY', sourceSceneId: 's' })
    const selectedOriginal = { ...added, selection: { sceneId: 's', entityId: null } }
    const s = coreReducer(selectedOriginal, { type: 'SCENE_SET_START', sceneId: 'scene_2' })
    expect(s.project!.activeSceneId).toBe('scene_2')
    expect(s.selection.sceneId).toBe('s')
    expect(s.projectDirty).toBe(true)
  })

  it('SCENE_DELETE blocks the only scene and the start scene', () => {
    const base = st(project())
    expect(coreReducer(base, { type: 'SCENE_DELETE', sceneId: 's' })).toBe(base)

    const added = coreReducer(base, { type: 'SCENE_ADD_EMPTY', sourceSceneId: 's' })
    const deletedStart = coreReducer(added, { type: 'SCENE_DELETE', sceneId: 's' })
    expect(deletedStart.project!.scenes.s).toBeDefined()
  })

  it('SCENE_DELETE removes orphan scene entities, thumbnails and entity logic boards', () => {
    const p: ProjectDoc = {
      ...project(),
      entities: {
        ...project().entities,
        2: {
          id: 2, name: 'B', className: 'Enemy', tags: [],
          transform: { position: { x: 1, y: 1 }, scale: { x: 1, y: 1 }, rotation: 0 },
          sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
        },
      },
      scenes: {
        ...project().scenes,
        scene_2: {
          id: 'scene_2', name: 'Scene 2',
          worldSize: { x: 1280, y: 720 },
          viewportSize: { x: 1280, y: 720 },
          backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
          entityIds: [2],
        },
      },
      thumbnails: { scene_2: 'data:image/png;base64,x' },
      logicBoards: [{
        boardId: 'b2',
        target: { type: 'entity_id', entityId: 2 },
        events: [],
      }],
    }
    const s = coreReducer({ ...st(p), selection: { sceneId: 'scene_2', entityId: 2 } }, {
      type: 'SCENE_DELETE', sceneId: 'scene_2',
    })
    expect(s.project!.scenes.scene_2).toBeUndefined()
    expect(s.project!.entities[2]).toBeUndefined()
    expect(s.project!.thumbnails).toBeUndefined()
    expect(s.project!.logicBoards).toBeUndefined()
    expect(s.selection).toEqual({ sceneId: 's', entityId: null })
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
