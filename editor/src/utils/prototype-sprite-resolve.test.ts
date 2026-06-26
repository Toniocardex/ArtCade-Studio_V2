import { describe, expect, it } from 'vitest'
import type { ProjectDoc } from '../types'
import { fillColorToHex } from './sprite-fill-color'
import { generatePrototypeSpriteAsset, prototypeAssetIdForType } from './prototype-sprite'
import {
  normalizePrototypeSprites,
  resolveImageAssetDataUrl,
  resolvePrototypeSpriteForInstance,
  resolvePrototypeSpriteForType,
  resolvePrototypeSpriteFromAsset,
} from './prototype-sprite-resolve'

function baseProject(overrides: Partial<ProjectDoc> = {}): ProjectDoc {
  return {
    projectName: 'T',
    version: '1',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: {
      s: {
        id: 's',
        name: 'Main',
        entityIds: [1],
        instances: [{
          id: 1,
          objectTypeId: 'Object_p',
          transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        }],
      },
    },
    ...overrides,
  }
}

describe('prototype-sprite-resolve (SSOT)', () => {
  it('resolvePrototypeSpriteForType uses palette from typeId when binding is wrong', () => {
    const shared = generatePrototypeSpriteAsset({ typeId: 'Object', typeName: 'Object' })
    const project = baseProject({
      assets: { [shared.id]: shared },
      objectTypes: {
        Object_p: {
          id: 'Object_p',
          displayName: 'Object_p',
          tags: [],
          sprite: {
            spriteAssetId: shared.id,
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
          },
        },
      },
    })
    const view = resolvePrototypeSpriteForType(project, 'Object_p')
    expect(view).not.toBeNull()
    expect(view!.bindingOk).toBe(false)
    expect(fillColorToHex(view!.baseColor).toUpperCase()).toBe('#9B59B6')
    expect(view!.assetId).toBe(prototypeAssetIdForType('Object_p'))
  })

  it('inspector, asset row, and WASM dataUrl share the same SSOT view', () => {
    const asset = generatePrototypeSpriteAsset({ typeId: 'Object_p', typeName: 'Object_p' })
    const project = baseProject({
      assets: { [asset.id]: asset },
      objectTypes: {
        Object_p: {
          id: 'Object_p',
          displayName: 'Object_p',
          tags: [],
          sprite: {
            spriteAssetId: asset.id,
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
          },
        },
      },
    })
    const fromType = resolvePrototypeSpriteForType(project, 'Object_p')
    const fromInstance = resolvePrototypeSpriteForInstance(project, 1)
    const fromAsset = resolvePrototypeSpriteFromAsset(project, asset)
    const dataUrl = resolveImageAssetDataUrl(asset, project)
    expect(fromInstance).toEqual(fromType)
    expect(fromAsset).toEqual(fromType)
    expect(dataUrl).toBe(fromType!.dataUrl)
    expect(fromType!.bindingOk).toBe(true)
    expect(fromType!.assetId).toBe(prototypeAssetIdForType('Object_p'))
  })

  it('normalizePrototypeSprites repairs bindings then hydrates assets', () => {
    const shared = generatePrototypeSpriteAsset({ typeId: 'Object', typeName: 'Object' })
    const sprite = {
      spriteAssetId: shared.id,
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
    }
    const project = baseProject({
      assets: { [shared.id]: shared },
      objectTypes: {
        Object: { id: 'Object', displayName: 'Object', tags: [], sprite: { ...sprite } },
        Object_p: { id: 'Object_p', displayName: 'Object_p', tags: [], sprite: { ...sprite } },
      },
    })
    const { project: next, changed } = normalizePrototypeSprites(project)
    expect(changed).toBe(true)
    expect(next.objectTypes!.Object_p.sprite.spriteAssetId).toBe(prototypeAssetIdForType('Object_p'))
    const view = resolvePrototypeSpriteForType(next, 'Object_p')
    expect(view!.bindingOk).toBe(true)
    expect(fillColorToHex(view!.baseColor).toUpperCase()).toBe('#9B59B6')
  })
})
