import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import {
  createLogicBoardForObjectType,
  createLogicEvent,
} from '../utils/logic-board/factory'
import type { ProjectDoc } from '../types'
import { DEFAULT_DOCK_PANEL_VISIBILITY } from '../constants/dock-panels'
import { MAX_PROJECT_HISTORY, pushProjectHistory, projectRevision, snapshotProjectHistory } from './project-history'

function projectWithEntity(): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1,
        name: 'Box',
        className: 'Box',
        tags: [],
        transform: {
          position: { x: 10, y: 20 },
          scale: { x: 1, y: 1 },
          rotation: 0,
        },
        visible: true,
      },
    },
    scenes: {
      s: {
        id: 's',
        name: 'S',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [1],
      },
    },
  }
}

function baseState(project: ProjectDoc | null = projectWithEntity()): CoreState {
  return {
    project,
    projectPath: null,
    projectDirty: false,
    selection: { entityId: 1, sceneId: 's' },
    mode: 'canvas',
    consoleOpen: false,
    bottomPanelCollapsed: true,
    dockPanelVisibility: DEFAULT_DOCK_PANEL_VISIBILITY,
    consoleAckUpToId: 0,
    activePaintTilesetId: null,
    tilePaletteOpen: false,
    lastPaintTilesetByLayer: {},
    recentPaintTilesetIds: [],
    paintSourceNotice: null,
    openScripts: [],
    activeScriptPath: null,
    isPlaying: false,
    selectedTileCell: 1,
    editorGridSize: 32,
    snapToGrid: false,
    editorZoom: 1.0,
    editorZoomMode: 'manual',
    cameraPreview: false,
    projectLoadEpoch: 0,
    authoringMode: 'base',
    dialogs: {},
    selectedDialogId: null,
    dialogModal: { open: false, dialogId: null },
    spritesheetStudio: { open: false, imageAssetId: null },
    projectHistory: { past: [], future: [] },
    logicPreviewAppliedRevision: null,
  }
}

describe('project-history', () => {
  it('snapshotProjectHistory deduplicates identical revisions', () => {
    const s0 = baseState()
    const s1 = snapshotProjectHistory(s0)
    const s2 = snapshotProjectHistory(s1)
    expect(s1.projectHistory?.past).toHaveLength(1)
    expect(s2.projectHistory?.past).toHaveLength(1)
  })

  it('PROJECT_UNDO restores entity transform', () => {
    let s = baseState()
    s = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 99,
      y: 88,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    })
    expect(s.project?.entities[1]?.transform.position).toEqual({ x: 99, y: 88 })
    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.project?.entities[1]?.transform.position).toEqual({ x: 10, y: 20 })
  })

  it('UPDATE_ENTITY_TRANSFORM with recordHistory false does not grow past', () => {
    let s = baseState()
    s = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 50,
      y: 50,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      recordHistory: false,
    })
    expect(s.projectHistory?.past).toHaveLength(0)
    s = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 60,
      y: 60,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    })
    expect(s.projectHistory?.past).toHaveLength(1)
    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.project?.entities[1]?.transform.position).toEqual({ x: 50, y: 50 })
  })

  it('IMAGE_ASSET_SET_CLIPS coalesces consecutive edits sharing a key into one undo', () => {
    const p = projectWithEntity()
    p.assets = { img: { id: 'img', name: 'a.png', path: 'assets/images/a.png' } }
    let s = baseState(p)
    const clipsNamed = (name: string) => [
      { name, frames: [{ x: 0, y: 0, w: 8, h: 8 }], fps: 12, loop: true },
    ]
    for (const name of ['i', 'id', 'idle']) {
      s = coreReducer(s, {
        type: 'IMAGE_ASSET_SET_CLIPS',
        assetId: 'img',
        clips: clipsNamed(name),
        coalesceKey: 'clip-name:0',
      })
    }
    expect(s.projectHistory?.past).toHaveLength(1)
    expect(s.project?.assets?.img.clips?.[0]?.name).toBe('idle')
    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.project?.assets?.img.clips).toBeUndefined()
  })

  it('IMAGE_ASSET_SET_CLIPS with a different/absent key starts a new undo entry', () => {
    const p = projectWithEntity()
    p.assets = { img: { id: 'img', name: 'a.png', path: 'assets/images/a.png' } }
    let s = baseState(p)
    s = coreReducer(s, {
      type: 'IMAGE_ASSET_SET_CLIPS',
      assetId: 'img',
      clips: [{ name: 'walk', frames: [{ x: 0, y: 0, w: 8, h: 8 }], fps: 12, loop: true }],
      coalesceKey: 'clip-name:0',
    })
    // A frame edit (no coalesce key) ends the run → separate snapshot.
    s = coreReducer(s, {
      type: 'IMAGE_ASSET_SET_CLIPS',
      assetId: 'img',
      clips: [
        {
          name: 'walk',
          frames: [
            { x: 0, y: 0, w: 8, h: 8 },
            { x: 8, y: 0, w: 8, h: 8 },
          ],
          fps: 12,
          loop: true,
        },
      ],
    })
    expect(s.projectHistory?.past).toHaveLength(2)
  })

  it('unified undo crosses logic board and entity edits', () => {
    const board = createLogicBoardForObjectType('Box', 'pc')
    let s = coreReducer(baseState(), { type: 'LOGIC_ADD_BOARD', board })
    s = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 200,
      y: 200,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    })
    expect(s.project?.logicBoards).toHaveLength(1)
    expect(s.project?.entities[1]?.transform.position.x).toBe(200)
    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.project?.entities[1]?.transform.position.x).toBe(10)
    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.project?.logicBoards ?? []).toHaveLength(0)
  })

  it('PROJECT_UNDO clears selection when entity was deleted', () => {
    let s = baseState()
    s = coreReducer(s, { type: 'ENTITY_DELETE', entityId: 1 })
    expect(s.selection.entityId).toBeNull()
    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.project?.entities[1]).toBeDefined()
    // Selection is not snapshotted; user may re-select the restored entity.
    expect(s.selection.entityId).toBeNull()
  })

  it('PROJECT_UNDO clears selection when entity is not in the current scene', () => {
    const p = projectWithEntity()
    const entityOnlyInOtherScene: ProjectDoc = {
      ...p,
      scenes: {
        ...p.scenes,
        s: { ...p.scenes.s, entityIds: [] },
        s2: {
          id: 's2',
          name: 'S2',
          worldSize: { x: 800, y: 600 },
          viewportSize: { x: 800, y: 600 },
          backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
          entityIds: [1],
        },
      },
    }
    let s: CoreState = {
      ...baseState(entityOnlyInOtherScene),
      selection: { entityId: 1, sceneId: 's' },
    }
    s = coreReducer(s, { type: 'PROJECT_RENAME', name: 'Snapshot' })
    s = coreReducer(s, { type: 'PROJECT_UNDO' })
    expect(s.selection.entityId).toBeNull()
    expect(s.selection.sceneId).toBe('s')
  })

  it('caps history at MAX_PROJECT_HISTORY', () => {
    let s = baseState()
    for (let i = 0; i < MAX_PROJECT_HISTORY + 5; i++) {
      s = coreReducer(s, { type: 'PROJECT_RENAME', name: `Name ${i}` })
    }
    expect(s.projectHistory?.past.length).toBeLessThanOrEqual(MAX_PROJECT_HISTORY)
    expect(projectRevision(s.project!)).toContain(`Name ${MAX_PROJECT_HISTORY + 4}`)
  })
})
