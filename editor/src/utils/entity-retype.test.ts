import { describe, expect, it } from 'vitest'
import { coreReducer, type CoreState } from '../store/editor-store'
import { sceneAssetDescriptors } from './asset-orchestrator'
import {
  assertPrototypeOwnership,
  buildEntityRetypeAction,
} from './entity-retype'
import {
  buildObjectTypeAddAction,
  patchPrototypeSpriteColor,
  prototypeAssetIdForType,
} from './prototype-sprite'
import type { ProjectDoc } from '../types'

function emptySceneProject(): ProjectDoc {
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

function createProjectWithType(typeName: string): CoreState {
  const add = buildObjectTypeAddAction(typeName)
  let state = coreReducer(st(emptySceneProject()), add)
  state = coreReducer(state, {
    type: 'INSTANCE_ADD_FROM_TYPE',
    sceneId: 's',
    objectTypeId: add.typeId,
  })
  return state
}

describe('entity-retype', () => {
  it('creates a dedicated prototype when retyping to a new class', () => {
    const base = createProjectWithType('Object')
    const state = coreReducer(
      base,
      buildEntityRetypeAction(base.project!, 1, 'Object_p')!,
    )

    const original = state.project!.objectTypes!.Object
    const variant = state.project!.objectTypes!.Object_p

    expect(original.sprite.spriteAssetId).toBe(prototypeAssetIdForType('Object'))
    expect(variant.sprite.spriteAssetId).toBe(prototypeAssetIdForType('Object_p'))
    expect(original.sprite.spriteAssetId).not.toBe(variant.sprite.spriteAssetId)
    expect(state.project!.assets!['gen_proto_Object_p'].generated?.ownerTypeId).toBe('Object_p')

    assertPrototypeOwnership(state.project!, 'Object')
    assertPrototypeOwnership(state.project!, 'Object_p')
  })

  it('changing variant color does not mutate source prototype', () => {
    let state = createProjectWithType('Object')
    state = coreReducer(
      state,
      buildEntityRetypeAction(state.project!, 1, 'Object_p')!,
    )

    const beforeOriginalDataUrl = state.project!.assets!['gen_proto_Object'].dataUrl
    const purple = { x: 155 / 255, y: 89 / 255, z: 182 / 255 }
    const changedVariant = patchPrototypeSpriteColor(
      state.project!.assets!['gen_proto_Object_p'],
      purple,
    )

    state = coreReducer(state, { type: 'ASSET_ADD', asset: changedVariant })

    expect(state.project!.assets!['gen_proto_Object_p'].dataUrl).not.toBe(beforeOriginalDataUrl)
    expect(state.project!.assets!['gen_proto_Object'].dataUrl).toBe(beforeOriginalDataUrl)
  })

  it('scene asset descriptors include both prototype paths after retype', () => {
    let state = createProjectWithType('Object')
    state = coreReducer(state, {
      type: 'INSTANCE_ADD_FROM_TYPE',
      sceneId: 's',
      objectTypeId: 'Object',
    })
    state = coreReducer(
      state,
      buildEntityRetypeAction(state.project!, 1, 'Object_p')!,
    )

    const descriptors = sceneAssetDescriptors(state.project!, 's')
    expect(descriptors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: '__generated__/prototype/gen_proto_Object.png',
      }),
      expect.objectContaining({
        path: '__generated__/prototype/gen_proto_Object_p.png',
      }),
    ]))
  })

  it('retargets to an existing type without creating a new prototype', () => {
    let state = createProjectWithType('Object')
    state = coreReducer(state, buildObjectTypeAddAction('Object_p'))
    const assetCountBefore = Object.keys(state.project!.assets ?? {}).length

    state = coreReducer(
      state,
      buildEntityRetypeAction(state.project!, 1, 'Object_p')!,
    )

    expect(state.project!.scenes.s.instances?.[0].objectTypeId).toBe('Object_p')
    expect(Object.keys(state.project!.assets ?? {}).length).toBe(assetCountBefore)
  })
})
