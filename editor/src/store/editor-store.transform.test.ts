import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import type { ProjectDoc } from '../types'
import { DEFAULT_DOCK_PANEL_VISIBILITY } from '../constants/dock-panels'

function vec(x: number, y: number) { return { x, y } }

function makeState(): CoreState {
  const project: ProjectDoc = {
    projectName: 'T', version: '1', activeSceneId: 'scene_a',
    mainScriptPath: 'm.lua', targetFPS: 60,
    entities: {
      1: {
        id: 1, name: 'P', className: 'Player', tags: [],
        transform: { position: vec(100, 200), scale: vec(2, 1), rotation: 0.5 },
        sprite: {
          spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 },
          alpha: 1, pivot: vec(0.5, 0.5), renderOrder: 0,
        },
      },
    },
    scenes: {
      scene_a: {
        id: 'scene_a', name: 'A',
        worldSize: vec(800, 600), viewportSize: vec(800, 600),
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1],
      },
    },
  }
  return {
    project,
    projectPath: null,
    projectDirty: false,
    selection: { entityId: 1, sceneId: 'scene_a' },
    mode: 'canvas',
    consoleOpen: false,
    bottomPanelCollapsed: true,
    dockPanelVisibility: DEFAULT_DOCK_PANEL_VISIBILITY,
    consoleAckUpToId: 0,
    editingTilesetId: null,
    openScripts: [],
    activeScriptPath: null,
    isPlaying: false,
    selectedTileCell: 0,
    editorGridSize: 32, snapToGrid: false,
    editorZoom: 1.0, editorZoomMode: 'manual', cameraPreview: false, projectLoadEpoch: 0, authoringMode: 'base',
  } as CoreState
}

describe('UPDATE_ENTITY_TRANSFORM equality guard', () => {
  it('returns the same state when the transform did not change', () => {
    const s = makeState()
    const next = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 100, y: 200,
      rotation: 0.5,
      scaleX: 2, scaleY: 1,
    })
    expect(next).toBe(s)
    expect(next.projectDirty).toBe(false)
  })

  it('treats sub-epsilon position drift as no change', () => {
    const s = makeState()
    const next = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 100 + 1e-6, y: 200 - 1e-6,
      rotation: 0.5,
      scaleX: 2, scaleY: 1,
    })
    expect(next).toBe(s)
  })

  it('marks dirty and updates transform when position changes', () => {
    const s = makeState()
    const next = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 110, y: 200,
      rotation: 0.5,
      scaleX: 2, scaleY: 1,
    })
    expect(next).not.toBe(s)
    expect(next.projectDirty).toBe(true)
    expect(next.project?.entities[1].transform.position.x).toBe(110)
  })

  it('marks dirty when only scale changes', () => {
    const s = makeState()
    const next = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 100, y: 200,
      rotation: 0.5,
      scaleX: 3, scaleY: 1,
    })
    expect(next.projectDirty).toBe(true)
    expect(next.project?.entities[1].transform.scale.x).toBe(3)
  })

  it('preserves rotation and scale when canvas drag updates position only (P1)', () => {
    const s = makeState()
    const next = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 110, y: 210,
      rotation: 0.5,
      scaleX: 2, scaleY: 1,
    })
    expect(next.project?.entities[1].transform.rotation).toBe(0.5)
    expect(next.project?.entities[1].transform.scale.x).toBe(2)
    expect(next.project?.entities[1].transform.scale.y).toBe(1)
  })

  it('ignores UPDATE_ENTITY_TRANSFORM while isPlaying', () => {
    const s = { ...makeState(), isPlaying: true }
    const next = coreReducer(s, {
      type: 'UPDATE_ENTITY_TRANSFORM',
      entityId: 1,
      x: 999, y: 888,
      rotation: 0,
      scaleX: 1, scaleY: 1,
    })
    expect(next).toBe(s)
    expect(next.project?.entities[1].transform.position.x).toBe(100)
  })
})
