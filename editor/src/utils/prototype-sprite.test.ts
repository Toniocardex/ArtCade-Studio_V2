import { describe, expect, it } from 'vitest'
import {
  buildObjectTypeAddAction,
  buildPromotedPrototypeAsset,
  ensurePrototypeSpriteForObjectType,
  generatePrototypeSpriteAsset,
  prototypeAssetIdForType,
  prototypeAssetMatchesType,
  prototypeSpriteVirtualPath,
  isGeneratedPrototypeAsset,
  patchPrototypeSpriteColor,
  resetPrototypeSpriteAsset,
  prototypeHasUserEdits,
  clearSpriteClipFields,
  resolvePrototypeBaseColor,
} from './prototype-sprite'
import {
  resolveImageAssetDataUrl,
} from './prototype-sprite-resolve'
import { fillColorToHex } from './sprite-fill-color'
import { resolveSpriteLoadKey, spriteAssetRef, spriteReferencesImageAsset, detachImageAssetFromSprites } from './sprite-asset-ref'
import { resolveImageLoadKey } from './resolve-image-load-key'
import type { ProjectDoc } from '../types'

describe('prototype-sprite', () => {
  it('resolvePrototypeBaseColor uses palette for unmodified Object type', () => {
    const asset = generatePrototypeSpriteAsset({ typeId: 'Object', typeName: 'Object' })
    const resolved = resolvePrototypeBaseColor(asset, 'Object')
    expect(fillColorToHex(resolved).toUpperCase()).toBe('#00BCD4')
  })

  it('resolvePrototypeBaseColor derives owner type id from gen_proto_ asset id', () => {
    const asset = generatePrototypeSpriteAsset({ typeId: 'Object', typeName: 'Object' })
    const stripped = {
      ...asset,
      generated: {
        ...asset.generated!,
        ownerTypeId: undefined,
        baseColor: { x: 46 / 255, y: 204 / 255, z: 113 / 255 },
        modified: false,
      },
    }
    expect(fillColorToHex(resolvePrototypeBaseColor(stripped)).toUpperCase()).toBe('#00BCD4')
    expect(resolveImageAssetDataUrl(stripped)?.startsWith('data:image/png')).toBe(true)
  })

  it('resolvePrototypeBaseColor keeps user-edited color when modified', () => {
    const asset = generatePrototypeSpriteAsset({ typeId: 'Object', typeName: 'Object' })
    const edited = patchPrototypeSpriteColor(asset, { x: 46 / 255, y: 204 / 255, z: 113 / 255 })
    expect(fillColorToHex(resolvePrototypeBaseColor(edited, 'Object')).toUpperCase()).toBe('#2ECC71')
  })

  it('buildObjectTypeAddAction materializes prototype asset with stable ids', () => {
    const action = buildObjectTypeAddAction('Coin')
    expect(action.type).toBe('OBJECT_TYPE_ADD')
    expect(action.typeId).toBe('Coin')
    expect(action.prototypeAsset.id).toBe(prototypeAssetIdForType('Coin'))
    expect(action.prototypeAsset.path).toBe(prototypeSpriteVirtualPath(action.prototypeAsset.id))
    expect(isGeneratedPrototypeAsset(action.prototypeAsset)).toBe(true)
    expect(action.prototypeAsset.dataUrl?.startsWith('data:image/png')).toBe(true)
  })

  it('patchPrototypeSpriteColor regenerates dataUrl', () => {
    const asset = generatePrototypeSpriteAsset({ typeId: 'Box', typeName: 'Box' })
    const next = patchPrototypeSpriteColor(asset, { x: 1, y: 0, z: 0 })
    expect(next.generated?.baseColor).toEqual({ x: 1, y: 0, z: 0 })
    expect(next.generated?.modified).toBe(true)
    if (typeof document !== 'undefined') {
      expect(next.dataUrl).not.toBe(asset.dataUrl)
    }
  })

  it('resetPrototypeSpriteAsset clears studio fields but keeps stable id/path', () => {
    const asset = generatePrototypeSpriteAsset({ typeId: 'Box', typeName: 'Box' })
    asset.clips = [{ name: 'idle', fps: 8, loop: true, frames: [{ x: 0, y: 0, w: 16, h: 16 }] }]
    asset.generated!.modified = true
    const reset = resetPrototypeSpriteAsset({
      asset,
      typeId: 'Box',
      typeName: 'Box',
    })
    expect(reset.id).toBe(asset.id)
    expect(reset.path).toBe(asset.path)
    expect(isGeneratedPrototypeAsset(reset)).toBe(true)
    expect(reset.generated?.modified).toBe(false)
    expect(reset.clips).toBeUndefined()
  })

  it('buildPromotedPrototypeAsset becomes imported with real path', () => {
    const asset = generatePrototypeSpriteAsset({ typeId: 'Hero', typeName: 'Hero' })
    const promoted = buildPromotedPrototypeAsset(asset, {
      id: asset.id,
      path: 'assets/images/gen_proto_Hero_hero.png',
      persisted: true,
    }, 'Hero')
    expect(promoted.source).toBe('imported')
    expect(promoted.generated).toBeUndefined()
    expect(promoted.path).toMatch(/^assets\/images\//)
  })

  it('prototypeHasUserEdits detects modified flag and clips', () => {
    const asset = generatePrototypeSpriteAsset({ typeId: 'A', typeName: 'A' })
    const project = {
      projectName: 'T',
      version: '1',
      targetFPS: 60,
      activeSceneId: 's',
      mainScriptPath: 'scripts/main.lua',
      entities: {},
      scenes: {},
    }
    expect(prototypeHasUserEdits(project, asset)).toBe(false)
    expect(prototypeHasUserEdits(project, patchPrototypeSpriteColor(asset, { x: 0, y: 0, z: 0 }))).toBe(true)
  })

  it('clearSpriteClipFields removes default clip spawn fields', () => {
    const next = clearSpriteClipFields({
      spriteAssetId: 'img',
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
      defaultClip: 'walk',
      playClipOnSpawn: true,
    })
    expect(next.defaultClip).toBeUndefined()
    expect(next.playClipOnSpawn).toBe(false)
  })

  it('prototypeAssetMatchesType requires gen_proto_{typeId} id and owner', () => {
    const objectAsset = generatePrototypeSpriteAsset({ typeId: 'Object', typeName: 'Object' })
    const object1Asset = generatePrototypeSpriteAsset({ typeId: 'Object1', typeName: 'Object1' })
    expect(prototypeAssetMatchesType(objectAsset, 'Object')).toBe(true)
    expect(prototypeAssetMatchesType(object1Asset, 'Object')).toBe(false)
    expect(prototypeAssetMatchesType(objectAsset, 'Object_p')).toBe(false)
  })

  it('ensurePrototypeSpriteForObjectType repairs shared prototype refs', () => {
    const shared = generatePrototypeSpriteAsset({ typeId: 'Object', typeName: 'Object' })
    const typeSprite = {
      spriteAssetId: shared.id,
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
    }
    const project: ProjectDoc = {
      projectName: 'T',
      version: '1',
      targetFPS: 60,
      activeSceneId: 's',
      mainScriptPath: 'scripts/main.lua',
      assets: { [shared.id]: shared },
      entities: {},
      scenes: {},
      objectTypes: {
        Object: {
          id: 'Object',
          displayName: 'Object',
          tags: [],
          sprite: typeSprite,
        },
        Object_p: {
          id: 'Object_p',
          displayName: 'Object_p',
          tags: [],
          sprite: { ...typeSprite },
        },
      },
    }
    const { project: repaired, changed } = ensurePrototypeSpriteForObjectType(
      project,
      'Object_p',
      project.objectTypes!.Object_p,
    )
    expect(changed).toBe(true)
    const boundId = repaired.objectTypes!.Object_p.sprite.spriteAssetId
    expect(boundId).toBe(prototypeAssetIdForType('Object_p'))
    expect(boundId).not.toBe(shared.id)
    expect(prototypeAssetMatchesType(repaired.assets![boundId!], 'Object_p')).toBe(true)
    expect(fillColorToHex(resolvePrototypeBaseColor(repaired.assets![boundId!], 'Object_p')).toUpperCase())
      .toBe('#9B59B6')
  })
})

describe('sprite-asset-ref', () => {
  const project: ProjectDoc = {
    projectName: 'T',
    version: '1',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    assets: {
      img_a: {
        id: 'img_a',
        name: 'Hero',
        path: 'assets/images/hero.png',
        usage: 'sprite',
      },
    },
    entities: {},
    scenes: {},
  }

  it('resolveSpriteLoadKey never returns raw asset id', () => {
    const key = resolveSpriteLoadKey(project, {
      spriteAssetId: 'img_a',
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
    })
    expect(key).toBe('assets/images/hero.png')
    expect(key).not.toBe('img_a')
  })

  it('spriteAssetRef treats null and empty as no visual', () => {
    expect(spriteAssetRef({
      spriteAssetId: null,
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
    })).toBeNull()
    expect(resolveImageLoadKey(project, 'img_a')).toBe('assets/images/hero.png')
  })

  it('detachImageAssetFromSprites clears id and legacy path refs', () => {
    const base: ProjectDoc = {
      ...project,
      assets: {
        img_a: {
          id: 'img_a',
          name: 'Hero',
          path: 'assets/images/hero.png',
          usage: 'sprite',
        },
      },
      entities: {
        1: {
          id: 1,
          name: 'A',
          className: 'Player',
          tags: [],
          transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
          sprite: {
            spriteAssetId: 'img_a',
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
          },
          visible: true,
        },
        2: {
          id: 2,
          name: 'B',
          className: 'Other',
          tags: [],
          transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
          sprite: {
            spriteAssetId: 'assets/images/hero.png',
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
          },
          visible: true,
        },
      },
    }
    const next = detachImageAssetFromSprites(base, {
      id: 'img_a',
      path: 'assets/images/hero.png',
    })
    expect(next.entities![1].sprite.spriteAssetId).toBeNull()
    expect(next.entities![2].sprite.spriteAssetId).toBeNull()
  })
})
