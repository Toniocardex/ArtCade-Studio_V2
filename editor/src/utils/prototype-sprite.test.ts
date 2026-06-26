import { describe, expect, it } from 'vitest'
import {
  buildObjectTypeAddAction,
  buildPromotedPrototypeAsset,
  generatePrototypeSpriteAsset,
  prototypeAssetIdForType,
  prototypeSpriteVirtualPath,
  isGeneratedPrototypeAsset,
  patchPrototypeSpriteColor,
  resetPrototypeSpriteAsset,
  prototypeHasUserEdits,
  clearSpriteClipFields,
} from './prototype-sprite'
import { resolveSpriteLoadKey, spriteAssetRef, spriteReferencesImageAsset, detachImageAssetFromSprites } from './sprite-asset-ref'
import { resolveImageLoadKey } from './resolve-image-load-key'
import type { ProjectDoc } from '../types'

describe('prototype-sprite', () => {
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
