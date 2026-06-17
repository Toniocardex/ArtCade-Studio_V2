import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import type { ProjectDoc } from '../types'

function project(): ProjectDoc {
  return {
    projectName: 'T', version: '1', activeSceneId: 's',
    mainScriptPath: 'm.lua', targetFPS: 60,
    entities: {
      1: {
        id: 1, name: 'Hero', className: 'Player', tags: ['player'],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: {
          spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 },
          alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0,
        },
      },
    },
    scenes: {
      s: {
        id: 's', name: 'S', worldSize: { x: 800, y: 600 }, viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1],
      },
    },
  }
}

function st(p: ProjectDoc): CoreState {
  return {
    project: p, projectPath: null, projectDirty: false,
    selection: { entityId: 1, sceneId: 's' },
    mode: 'canvas', consoleOpen: false, bottomPanelCollapsed: true,
    dockPanelVisibility: { console: true, timeline: false, events: false },
    consoleAckUpToId: 0,
    activePaintTilesetId: null,
    tilePaletteOpen: false,
    lastPaintTilesetByLayer: {},
    recentPaintTilesetIds: [],
    paintSourceNotice: null,
    openScripts: [], activeScriptPath: null, isPlaying: false, selectedTileCell: 0,
    editorGridSize: 32, snapToGrid: false, editorZoom: 1.0, editorZoomMode: 'manual',
    cameraPreview: false, projectLoadEpoch: 0, authoringMode: 'base',
  }
}

describe('entity tags', () => {
  it('ENTITY_ADD_TAG appends a trimmed tag and marks dirty', () => {
    const next = coreReducer(st(project()), {
      type: 'ENTITY_ADD_TAG', entityId: 1, tag: '  pickup  ',
    })
    expect(next.project!.entities[1].tags).toEqual(['player', 'pickup'])
    expect(next.projectDirty).toBe(true)
  })

  it('ENTITY_ADD_TAG ignores duplicates and empty strings', () => {
    const base = st(project())
    expect(coreReducer(base, { type: 'ENTITY_ADD_TAG', entityId: 1, tag: 'player' })).toBe(base)
    expect(coreReducer(base, { type: 'ENTITY_ADD_TAG', entityId: 1, tag: '   ' })).toBe(base)
  })

  it('ENTITY_REMOVE_TAG removes a tag', () => {
    const next = coreReducer(st(project()), {
      type: 'ENTITY_REMOVE_TAG', entityId: 1, tag: 'player',
    })
    expect(next.project!.entities[1].tags).toEqual([])
    expect(next.projectDirty).toBe(true)
  })
})
