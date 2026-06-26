import { describe, expect, it } from 'vitest'
import { coreReducer, type CoreState } from '../store/editor-store'
import { buildObjectTypeAddAction } from '../utils/prototype-sprite'
import type { ProjectDoc } from '../types'

function st(project: ProjectDoc): CoreState {
  return {
    project,
    projectPath: null,
    projectDirty: false,
    selection: { entityId: 1, sceneId: 's' },
    instanceClipboard: null,
    mode: 'canvas',
    consoleOpen: false,
    bottomPanelCollapsed: true,
    dockPanelVisibility: { console: true, timeline: false, events: false },
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
  }
}

describe('IMAGE_ASSET_RESET_PROTOTYPE', () => {
  it('restores factory prototype and clears collision profile', () => {
    const add = buildObjectTypeAddAction('Coin')
    const base: ProjectDoc = {
      projectName: 'T',
      version: '1',
      targetFPS: 60,
      activeSceneId: 's',
      mainScriptPath: 'scripts/main.lua',
      objectTypes: {},
      entities: {},
      scenes: { s: { id: 's', name: 'S', worldSize: { x: 512, y: 320 }, viewportSize: { x: 512, y: 320 }, backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [] } },
    }
    let s = coreReducer(st(base), add)
    const assetId = add.prototypeAsset.id
    s = coreReducer(s, {
      type: 'COLLISION_PROFILE_SET',
      assetId,
      profile: {
        id: assetId,
        name: 'Coin',
        shapes: [],
      },
    })
    const modified = {
      ...s.project!.assets![assetId],
      clips: [{ name: 'spin', fps: 8, loop: true, frames: [{ x: 0, y: 0, w: 16, h: 16 }] }],
      generated: { ...s.project!.assets![assetId].generated!, modified: true },
    }
    s = coreReducer(s, { type: 'ASSET_ADD', asset: modified })

    const reset = coreReducer(s, {
      type: 'IMAGE_ASSET_RESET_PROTOTYPE',
      assetId,
      typeId: 'Coin',
      typeName: 'Coin',
    })

    const asset = reset.project!.assets![assetId]
    expect(asset.generated?.modified).toBe(false)
    expect(asset.clips).toBeUndefined()
    expect(reset.project!.collisionProfiles?.[assetId]).toBeUndefined()
    expect(reset.project!.objectTypes!.Coin.sprite.defaultClip).toBeUndefined()
  })
})
