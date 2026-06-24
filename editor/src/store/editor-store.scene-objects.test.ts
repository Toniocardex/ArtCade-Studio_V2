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
    objectTypes: {
      Player: {
        id: 'Player', displayName: 'Player', tags: [],
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
    },
    entities: {
      1: {
        id: 1, name: 'A', className: 'Player', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
    },
    scenes: {
      s: {
        id: 's', name: 'S', worldSize: { x: 1280, y: 720 }, viewportSize: { x: 1280, y: 720 }, backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1],
        instances: [{
          id: 1, objectTypeId: 'Player', instanceName: 'A',
          transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        }],
      },
    },
  }
}
function st(p: ProjectDoc): CoreState {
  return {
    project: p, projectPath: null, projectDirty: false,
    selection: { entityId: 1, sceneId: 's' },
    instanceClipboard: null,
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
  }
}

describe('coreReducer — scenes & objects', () => {
  it('OBJECT_TYPE_ADD + INSTANCE_ADD_FROM_TYPE creates an instance, adds to scene, selects it', () => {
    let s = coreReducer(st(project()), { type: 'OBJECT_TYPE_ADD', displayName: 'Coin' })
    expect(s.project!.objectTypes?.Coin).toBeDefined()
    s = coreReducer(s, { type: 'INSTANCE_ADD_FROM_TYPE', sceneId: 's', objectTypeId: 'Coin' })
    expect(Object.keys(s.project!.entities)).toHaveLength(2)
    expect(s.project!.entities[2]).toBeDefined()
    expect(s.project!.entities[2].transform.position).toEqual({ x: 640, y: 360 })
    expect(s.project!.entities[2].className).toBe('Coin')
    expect(s.project!.scenes.s.entityIds).toContain(2)
    expect(s.project!.scenes.s.instances?.some((i) => i.id === 2)).toBe(true)
    expect(s.selection.entityId).toBe(2)
    expect(s.projectDirty).toBe(true)
  })

  it('INSTANCE_ADD_FROM_TYPE persists the active authoring layer', () => {
    const base = {
      ...st({
        ...project(),
        layers: [{ id: 'lyr_gp', name: 'Gameplay' }, { id: 'lyr_bg', name: 'Background' }],
      }),
      editorActiveLayerId: 'lyr_gp',
    }

    const s = coreReducer(base, {
      type: 'INSTANCE_ADD_FROM_TYPE',
      sceneId: 's',
      objectTypeId: 'Player',
    })

    const inst = s.project!.scenes.s.instances?.find((i) => i.id === 2)
    expect(inst?.layerId).toBe('lyr_gp')
    expect(s.project!.entities[2].layerId).toBe('lyr_gp')
  })

  it('OBJECT_TYPE_ADD rejects duplicate names case-insensitively', () => {
    const s0 = st(project())
    const s = coreReducer(s0, { type: 'OBJECT_TYPE_ADD', displayName: 'player' })

    expect(Object.keys(s.project!.objectTypes ?? {})).toEqual(['Player'])
    expect(s.projectDirty).toBe(false)
  })

  it('OBJECT_TYPE_RENAME rejects a duplicate display name', () => {
    const withCoin = coreReducer(st(project()), { type: 'OBJECT_TYPE_ADD', displayName: 'Coin' })
    const renamed = coreReducer(withCoin, {
      type: 'OBJECT_TYPE_RENAME',
      objectTypeId: 'Coin',
      displayName: 'player',
    })

    expect(renamed.project!.objectTypes!.Coin.displayName).toBe('Coin')
  })

  it('INSTANCE_DUPLICATE adds a new instance of the same type, offsets, selects it', () => {
    const s = coreReducer(st(project()), { type: 'INSTANCE_DUPLICATE', instanceId: 1, sceneId: 's' })
    expect(Object.keys(s.project!.entities)).toHaveLength(2)
    const dup = s.project!.entities[2]
    expect(dup).toBeDefined()
    expect(dup.id).toBe(2)
    expect(dup.name).toBe('A_1')
    expect(dup.className).toBe('Player')
    expect(dup.transform.position).toEqual({ x: 16, y: 16 })
    // same shared type — no Entity_N inference
    const copyInst = s.project!.scenes.s.instances?.find((i) => i.id === 2)
    expect(copyInst?.objectTypeId).toBe('Player')
    expect(Object.keys(s.project!.objectTypes ?? {})).toEqual(['Player'])
    // source untouched
    expect(s.project!.entities[1].transform.position).toEqual({ x: 0, y: 0 })
    expect(s.project!.scenes.s.entityIds).toEqual([1, 2])
    expect(s.selection.entityId).toBe(2)
    expect(s.projectDirty).toBe(true)
  })

  it('INSTANCE_DUPLICATE preserves the source layer assignment', () => {
    const p = project()
    p.layers = [{ id: 'lyr_gp', name: 'Gameplay' }, { id: 'lyr_bg', name: 'Background' }]
    p.scenes.s.instances![0] = { ...p.scenes.s.instances![0]!, layerId: 'lyr_gp' }
    p.entities[1] = { ...p.entities[1], layerId: 'lyr_gp' }

    const s = coreReducer(st(p), { type: 'INSTANCE_DUPLICATE', instanceId: 1, sceneId: 's' })

    const copyInst = s.project!.scenes.s.instances?.find((i) => i.id === 2)
    expect(copyInst?.layerId).toBe('lyr_gp')
    expect(s.project!.entities[2].layerId).toBe('lyr_gp')
  })

  it('INSTANCE_DUPLICATE places the shared-type copy at an explicit canvas position', () => {
    const s = coreReducer(st(project()), {
      type: 'INSTANCE_DUPLICATE',
      instanceId: 1,
      sceneId: 's',
      position: { x: 352, y: 224 },
    })

    const copy = s.project!.entities[2]
    const copyInst = s.project!.scenes.s.instances?.find((instance) => instance.id === 2)
    expect(copy.id).toBe(2)
    expect(copy.name).toBe('A_1')
    expect(copy.transform.position).toEqual({ x: 352, y: 224 })
    expect(copyInst?.objectTypeId).toBe('Player')
    expect(copyInst?.transform.position).toEqual({ x: 352, y: 224 })
    expect(s.selection.entityId).toBe(2)
  })

  it('records a duplicate as one undoable project operation', () => {
    let s = coreReducer(st(project()), {
      type: 'INSTANCE_DUPLICATE',
      instanceId: 1,
      sceneId: 's',
      position: { x: 96, y: 64 },
    })
    expect(s.projectHistory?.past).toHaveLength(1)

    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.project!.entities[2]).toBeUndefined()
    expect(s.project!.scenes.s.instances).toHaveLength(1)

    s = coreReducer(s, { type: 'PROJECT_REDO' })
    expect(s.project!.entities[2]?.transform.position).toEqual({ x: 96, y: 64 })
    expect(s.project!.scenes.s.instances).toHaveLength(2)
  })

  it('copies and pastes an instance in the same scene with undo support', () => {
    let s = coreReducer(st(project()), { type: 'INSTANCE_COPY', instanceId: 1, sceneId: 's' })
    expect(s.instanceClipboard?.instance.objectTypeId).toBe('Player')
    expect(s.projectHistory?.past ?? []).toHaveLength(0)

    s = coreReducer(s, { type: 'INSTANCE_PASTE', sceneId: 's' })

    expect(s.project!.entities[2]).toBeDefined()
    expect(s.project!.entities[2].name).toBe('A_1')
    expect(s.project!.entities[2].transform.position).toEqual({ x: 16, y: 16 })
    expect(s.project!.scenes.s.instances?.find((i) => i.id === 2)?.objectTypeId).toBe('Player')
    expect(s.selection.entityId).toBe(2)
    expect(s.projectHistory?.past).toHaveLength(1)
    const reopened = parseProjectDoc(serializeProjectDoc(s.project!))!
    expect(reopened.scenes.s.instances?.find((i) => i.id === 2)?.objectTypeId).toBe('Player')
    expect(reopened.entities[2].transform.position).toEqual({ x: 16, y: 16 })

    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.project!.entities[2]).toBeUndefined()
    expect(s.project!.scenes.s.instances).toHaveLength(1)
  })

  it('does not paste a scene-local clipboard into another scene', () => {
    const withOtherScene: ProjectDoc = {
      ...project(),
      scenes: {
        ...project().scenes,
        other: {
          id: 'other',
          name: 'Other',
          worldSize: { x: 1280, y: 720 },
          viewportSize: { x: 1280, y: 720 },
          backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
          entityIds: [],
          instances: [],
        },
      },
    }
    let s = coreReducer(st(withOtherScene), { type: 'INSTANCE_COPY', instanceId: 1, sceneId: 's' })
    s = coreReducer(s, { type: 'INSTANCE_PASTE', sceneId: 'other' })

    expect(Object.keys(s.project!.entities)).toEqual(['1'])
    expect(s.project!.scenes.other.instances).toHaveLength(0)
  })

  it('shared type edit propagates to every instance (ENTITY_SET_SPRITE_FILL)', () => {
    let s = coreReducer(st(project()), { type: 'INSTANCE_DUPLICATE', instanceId: 1, sceneId: 's' })
    s = coreReducer(s, {
      type: 'ENTITY_SET_SPRITE_FILL',
      entityId: 1,
      fillColor: { x: 1, y: 0, z: 0 },
    })
    // Both instances re-materialized from the patched type.
    expect(s.project!.objectTypes?.Player.sprite.fillColor).toEqual({ x: 1, y: 0, z: 0 })
    expect(s.project!.entities[1].sprite.fillColor).toEqual({ x: 1, y: 0, z: 0 })
    expect(s.project!.entities[2].sprite.fillColor).toEqual({ x: 1, y: 0, z: 0 })
    // Placement stays per instance.
    expect(s.project!.entities[2].transform.position).toEqual({ x: 16, y: 16 })
    expect(s.project!.entities[2].name).toBe('A_1')
  })

  it('ENTITY_SET_NAME renames only the instance, not the type', () => {
    let s = coreReducer(st(project()), { type: 'INSTANCE_DUPLICATE', instanceId: 1, sceneId: 's' })
    s = coreReducer(s, { type: 'ENTITY_SET_NAME', entityId: 2, name: 'Hero' })
    expect(s.project!.entities[2].name).toBe('Hero')
    expect(s.project!.entities[1].name).toBe('A')
    expect(s.project!.objectTypes?.Player.displayName).toBe('Player')
    const inst = s.project!.scenes.s.instances?.find((i) => i.id === 2)
    expect(inst?.instanceName).toBe('Hero')
  })

  it('ENTITY_SET_NAME rejects duplicate instance names in the same scene', () => {
    let s = coreReducer(st(project()), { type: 'INSTANCE_DUPLICATE', instanceId: 1, sceneId: 's' })
    s = coreReducer(s, { type: 'ENTITY_SET_NAME', entityId: 2, name: 'A' })

    const inst = s.project!.scenes.s.instances?.find((i) => i.id === 2)
    expect(inst?.instanceName).toBe('A_1')
    expect(s.project!.entities[2].name).toBe('A_1')
  })

  it('insert flow syncs objectTypes so logic boards targeting the type validate', () => {
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
    const typeId = 'Entity_1'
    s = coreReducer(s, { type: 'OBJECT_TYPE_ADD', displayName: typeId })
    s = coreReducer(s, { type: 'INSTANCE_ADD_FROM_TYPE', sceneId: 's', objectTypeId: typeId })
    expect(s.project!.objectTypes?.[typeId]).toBeDefined()
    s = coreReducer(s, {
      type: 'LOGIC_ADD_BOARD',
      board: createLogicBoardForObjectType(typeId, 'board_test'),
    })
    const errors = projectDiagnosticsErrors(collectProjectDiagnostics(s.project!))
    expect(errors.some((e) => e.message.includes('unknown object type'))).toBe(false)
  })

  it('ENTITY_DELETE removes from entities + all scenes + deselects', () => {
    const s = coreReducer(
      { ...st(project()), selection: { entityId: 1, entityIds: [1], sceneId: 's' } },
      { type: 'ENTITY_DELETE', entityId: 1 },
    )
    expect(s.project!.entities[1]).toBeUndefined()
    expect(s.project!.scenes.s.entityIds).not.toContain(1)
    expect(s.selection.entityId).toBeNull()
    expect(s.selection.entityIds).toEqual([])
  })

  it('ENTITY_DELETE_MANY removes a multi-selection as one undoable operation', () => {
    let s = coreReducer(st(project()), { type: 'INSTANCE_DUPLICATE', instanceId: 1, sceneId: 's' })
    expect(s.project!.scenes.s.entityIds).toEqual([1, 2])

    s = coreReducer(
      { ...s, selection: { entityId: 2, entityIds: [1, 2], sceneId: 's' } },
      { type: 'ENTITY_DELETE_MANY', entityIds: [1, 2] },
    )

    expect(s.project!.entities[1]).toBeUndefined()
    expect(s.project!.entities[2]).toBeUndefined()
    expect(s.project!.scenes.s.entityIds).toEqual([])
    expect(s.project!.scenes.s.instances).toEqual([])
    expect(s.selection).toEqual({ entityId: null, entityIds: [], sceneId: 's' })
    expect(s.projectHistory?.past).toHaveLength(2)

    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.project!.scenes.s.entityIds).toEqual([1, 2])
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

  it('SCENE_SET_CAMERA_START stores the clamped initial camera position', () => {
    // World larger than the viewport so the camera has room to move.
    let s = coreReducer(st(project()), { type: 'SCENE_SET_WORLD_SIZE', sceneId: 's', x: 2560, y: 1440 })
    s = coreReducer({ ...s, projectDirty: false }, {
      type: 'SCENE_SET_CAMERA_START', sceneId: 's', x: 500, y: 300,
    })
    expect(s.project!.scenes.s.cameraStart).toEqual({ x: 500, y: 300 })
    expect(s.projectDirty).toBe(true)

    // Out-of-bounds drag is clamped so the viewport stays inside the world.
    s = coreReducer(s, { type: 'SCENE_SET_CAMERA_START', sceneId: 's', x: 99999, y: 99999 })
    expect(s.project!.scenes.s.cameraStart).toEqual({ x: 2560 - 1280, y: 1440 - 720 })
  })

  it('SCENE_SET_CAMERA_START snaps to the editor grid when snap-to-grid is on', () => {
    let s = coreReducer(st(project()), { type: 'SCENE_SET_WORLD_SIZE', sceneId: 's', x: 2560, y: 1440 })
    s = { ...s, snapToGrid: true, editorGridSize: 32 }
    s = coreReducer(s, { type: 'SCENE_SET_CAMERA_START', sceneId: 's', x: 500, y: 300 })
    // 500 → 512, 300 → 288 (nearest multiples of 32), then clamped to the world.
    expect(s.project!.scenes.s.cameraStart).toEqual({ x: 512, y: 288 })
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
    expect(s.selection).toEqual({ sceneId: 'scene_2', entityId: null, entityIds: [] })
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

  it('SCENE_DELETE removes orphan scene entities and thumbnails, keeps type boards', () => {
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
        target: { type: 'object_type', objectTypeId: 'Enemy' },
        events: [],
      }],
    }
    const s = coreReducer({ ...st(p), selection: { sceneId: 'scene_2', entityId: 2 } }, {
      type: 'SCENE_DELETE', sceneId: 'scene_2',
    })
    expect(s.project!.scenes.scene_2).toBeUndefined()
    expect(s.project!.entities[2]).toBeUndefined()
    expect(s.project!.thumbnails).toBeUndefined()
    // The board lives on the Enemy type, not on the deleted instance.
    expect(s.project!.logicBoards?.map((b) => b.boardId)).toEqual(['b2'])
    expect(s.selection).toEqual({ sceneId: 's', entityId: null, entityIds: [] })
    expect(s.projectDirty).toBe(true)
  })

  it('actions are no-ops without project / unknown entity', () => {
    const noProj = { ...st(project()), project: null }
    expect(
      coreReducer(noProj, { type: 'INSTANCE_ADD_FROM_TYPE', sceneId: 's', objectTypeId: 'X' })
        .projectDirty,
    ).toBe(false)
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
