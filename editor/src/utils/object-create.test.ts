import { describe, expect, it } from 'vitest'
import { coreReducer, type CoreState } from '../store/editor-store'
import {
  buildCreateObjectAction,
  createObjectErrorMessage,
  objectTypeCreateBlocked,
} from './object-create'
import { sceneAssetDescriptors } from './asset-orchestrator'
import {
  prototypeAssetIdForType,
  prototypeSpriteVirtualPath,
} from './prototype-sprite'
import { assertPrototypeOwnership } from './entity-retype'
import type { ProjectDoc } from '../types'

function emptyProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '1',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    objectTypes: {},
    entities: {},
    scenes: {
      s: {
        id: 's',
        name: 'S',
        worldSize: { x: 1280, y: 720 },
        viewportSize: { x: 1280, y: 720 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [],
        instances: [],
      },
    },
  }
}

function st(project: ProjectDoc): CoreState {
  return {
    project,
    projectPath: null,
    projectDirty: false,
    selection: { entityId: null, entityIds: [], sceneId: 's' },
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

describe('object-create', () => {
  it('buildCreateObjectAction rejects empty name', () => {
    const result = buildCreateObjectAction({
      project: emptyProject(),
      sceneId: 's',
      displayName: '   ',
    })
    expect(result).toEqual({ ok: false, error: 'invalid-name' })
  })

  it('buildCreateObjectAction rejects duplicate display name', () => {
    const project = {
      ...emptyProject(),
      objectTypes: {
        Player: {
          id: 'Player',
          displayName: 'player',
          tags: [],
          sprite: {
            spriteAssetId: null,
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
          },
        },
      },
    }
    const result = buildCreateObjectAction({
      project,
      sceneId: 's',
      displayName: 'Player',
    })
    expect(result).toEqual({ ok: false, error: 'duplicate-name' })
  })

  it('buildCreateObjectAction rejects duplicate normalized type id', () => {
    const project = {
      ...emptyProject(),
      objectTypes: {
        Enemy_Boss: {
          id: 'Enemy_Boss',
          displayName: 'Enemy Boss',
          tags: [],
          sprite: {
            spriteAssetId: null,
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
          },
        },
      },
    }
    const result = buildCreateObjectAction({
      project,
      sceneId: 's',
      displayName: 'Enemy-Boss',
    })
    expect(result).toEqual({ ok: false, error: 'duplicate-type-id' })
  })

  it('objectTypeCreateBlocked catches id collision when map key differs from type id', () => {
    const project = {
      ...emptyProject(),
      objectTypes: {
        LegacyKey: {
          id: 'Player',
          displayName: 'Hero',
          tags: [],
          sprite: {
            spriteAssetId: null,
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
          },
        },
      },
    }
    expect(objectTypeCreateBlocked(project, 'Player')).toBe('duplicate-type-id')
  })

  it('OBJECT_CREATE atomically adds type, asset, instance, and selection', () => {
    const built = buildCreateObjectAction({
      project: emptyProject(),
      sceneId: 's',
      displayName: 'Player',
      color: { x: 155 / 255, y: 89 / 255, z: 182 / 255 },
      position: { x: 100, y: 200 },
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return

    const state = coreReducer(st(emptyProject()), built.action)
    const typeId = 'Player'
    const assetId = prototypeAssetIdForType(typeId)

    expect(state.project!.objectTypes![typeId]).toBeDefined()
    expect(state.project!.assets![assetId]).toBeDefined()
    expect(state.project!.assets![assetId].path).toBe(prototypeSpriteVirtualPath(assetId))
    expect(state.project!.scenes.s.instances).toHaveLength(1)
    expect(state.project!.scenes.s.instances![0].objectTypeId).toBe(typeId)
    expect(state.project!.scenes.s.instances![0].transform.position).toEqual({ x: 100, y: 200 })
    expect(state.project!.entities[1].className).toBe('Player')
    expect(state.selection.entityId).toBe(1)
    expect(state.selection.entityIds).toEqual([1])
    assertPrototypeOwnership(state.project!, typeId)
  })

  it('OBJECT_CREATE assigns distinct prototype colors for two new types', () => {
    const purple = { x: 155 / 255, y: 89 / 255, z: 182 / 255 }
    const orange = { x: 230 / 255, y: 126 / 255, z: 34 / 255 }

    const player = buildCreateObjectAction({
      project: emptyProject(),
      sceneId: 's',
      displayName: 'Player',
      color: purple,
    })
    expect(player.ok).toBe(true)
    if (!player.ok) return

    let state = coreReducer(st(emptyProject()), player.action)
    const afterPlayer = state.project!

    const coin = buildCreateObjectAction({
      project: afterPlayer,
      sceneId: 's',
      displayName: 'Coin',
      color: orange,
    })
    expect(coin.ok).toBe(true)
    if (!coin.ok) return

    state = coreReducer(state, coin.action)

    const playerAsset = state.project!.assets![prototypeAssetIdForType('Player')]
    const coinAsset = state.project!.assets![prototypeAssetIdForType('Coin')]

    expect(playerAsset.generated?.baseColor).toEqual(purple)
    expect(coinAsset.generated?.baseColor).toEqual(orange)
    expect(playerAsset.dataUrl).not.toBe(coinAsset.dataUrl)

    const descriptors = sceneAssetDescriptors(state.project!, 's')
    expect(descriptors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: prototypeSpriteVirtualPath('gen_proto_Player') }),
      expect.objectContaining({ path: prototypeSpriteVirtualPath('gen_proto_Coin') }),
    ]))
  })

  it('OBJECT_CREATE duplicate dispatch is a no-op without entity corruption', () => {
    const built = buildCreateObjectAction({
      project: emptyProject(),
      sceneId: 's',
      displayName: 'Player',
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return

    let state = coreReducer(st(emptyProject()), built.action)
    const entitiesAfterFirst = { ...state.project!.entities }
    const instancesAfterFirst = [...(state.project!.scenes.s.instances ?? [])]

    state = coreReducer(state, built.action)

    expect(state.project!.entities).toEqual(entitiesAfterFirst)
    expect(state.project!.scenes.s.instances).toEqual(instancesAfterFirst)
    expect(Object.keys(state.project!.objectTypes ?? {})).toEqual(['Player'])
  })

  it('OBJECT_CREATE rejects a prematerialized instance id that is already in use', () => {
    const built = buildCreateObjectAction({
      project: emptyProject(),
      sceneId: 's',
      displayName: 'Player',
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return

    let state = coreReducer(st(emptyProject()), built.action)
    const existingEntity = state.project!.entities[1]

    const collision = {
      ...built.action,
      objectType: {
        ...built.action.objectType,
        id: 'Gem',
        displayName: 'Gem',
      },
      instance: {
        ...built.action.instance,
        id: 1,
        objectTypeId: 'Gem',
      },
    }

    state = coreReducer(state, collision)

    expect(state.project!.entities[1]).toEqual(existingEntity)
    expect(state.project!.objectTypes?.Gem).toBeUndefined()
    expect(state.project!.scenes.s.instances).toHaveLength(1)
  })

  it('OBJECT_CREATE persists the active authoring layer', () => {
    const built = buildCreateObjectAction({
      project: emptyProject(),
      sceneId: 's',
      displayName: 'Player',
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return

    const base = {
      ...st({
        ...emptyProject(),
        layers: [{ id: 'lyr_gp', name: 'Gameplay' }, { id: 'lyr_bg', name: 'Background' }],
      }),
      editorActiveLayerId: 'lyr_gp',
    }

    const state = coreReducer(base, built.action)
    const inst = state.project!.scenes.s.instances?.[0]

    expect(inst?.layerId).toBe('lyr_gp')
    expect(state.project!.entities[1].layerId).toBe('lyr_gp')
  })

  it('createObjectErrorMessage covers duplicate-type-id', () => {
    expect(createObjectErrorMessage('duplicate-type-id', 'Enemy-Boss')).toContain('Enemy-Boss')
  })
})
