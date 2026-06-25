// ---------------------------------------------------------------------------
// project-codec-roundtrip — serialize → parse must preserve project data
// ---------------------------------------------------------------------------
//
// Guards against the most common save/load bug class: a field that is mutated
// and marked dirty in the editor but silently dropped on disk because the
// serializer or parser does not know about it. Each block below builds a rich
// value, round-trips through JSON, and asserts the data survives.

import { describe, it, expect } from 'vitest'
import { serializeProjectDoc, parseProjectDoc } from './project-codec'
import { createBlankProject } from './project-factory'
import type { ObjectTypeDef, ProjectDoc, SceneInstanceDef } from '../types'

function richProject(): ProjectDoc {
  const p = createBlankProject('Round Trip')
  p.formatVersion = 3
  p.licenseTier = 'pro'
  p.version = '2.3.4'

  const hero: ObjectTypeDef = {
    id: 'Hero',
    displayName: 'Hero',
    tags: ['player', 'mortal'],
    sprite: {
      spriteAssetId: 'img_hero',
      tint: { x: 0.5, y: 0.6, z: 0.7, w: 0.8 },
      fillColor: { x: 0.1, y: 0.2, z: 0.3 },
      alpha: 0.9,
      pivotFromAsset: false,
      pivot: { x: 0.25, y: 0.75 },
      renderOrder: 5,
      defaultClip: 'idle',
      playClipOnSpawn: true,
    },
    physics: {
      bodyType: 'Dynamic',
      collider: {
        shape: 'Rectangle',
        size: { x: 16, y: 24 },
        offset: { x: 1, y: 2 },
        density: 1.5,
        friction: 0.3,
      },
    },
    scriptPath: 'scripts/hero.lua',
    visible: false,
    defaultLogicBoardId: 'board_hero',
    localVariables: [
      { key: 'hp', type: 'number', initialValue: 100, description: 'health' },
      { key: 'name', type: 'string', initialValue: 'Knight' },
    ],
  }
  // A second type that is NEVER placed — must still survive (regression guard).
  const pickup: ObjectTypeDef = {
    id: 'Pickup',
    displayName: 'Pickup',
    tags: [],
    sprite: {
      spriteAssetId: 'img_coin',
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivotFromAsset: true,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
    },
  }
  p.objectTypes = { Hero: hero, Pickup: pickup }

  const inst: SceneInstanceDef = {
    id: 1,
    objectTypeId: 'Hero',
    instanceName: 'Hero #1',
    transform: { position: { x: 40, y: 80 }, scale: { x: 2, y: 2 }, rotation: 1.5 },
    visible: false,
    layerId: 'lyr_mid',
    localVariableOverrides: { hp: 50, name: 'Override' },
  }
  p.scenes.scene_main.instances = [inst]
  p.scenes.scene_main.entityIds = [1]
  p.scenes.scene_main.backgroundColor = { x: 0.2, y: 0.3, z: 0.4, w: 1 }
  p.scenes.scene_main.layerSettings = {
    lyr_fg: { visible: false, opacity: 0.65, parallax: { x: 1.4, y: 1.2 } },
    lyr_bg: {
      parallax: { x: 0.3, y: 0.5 },
      background: { imageId: 'img_sky', tileX: true, tileY: false, scrollX: 10, scrollY: 0 },
    },
  }
  p.scenes.scene_main.tilemap = {
    tileSize: 16, cols: 3, rows: 2, data: [0, 1, 2, 3, 0, 1],
    defaultTilesetAssetId: 'ts_grass',
    tilesetSources: [{ tilesetAssetId: 'ts_grass' }],
    sourceIndices: [0, 0, 0, 0, 0, 0],
  }

  p.assets = {
    img_hero: {
      id: 'img_hero', name: 'hero.png', path: 'assets/images/img_hero.png', usage: 'sprite',
      contentHash: 'hash_hero',
      defaultPivot: { x: 0.5, y: 1 },
      imagePoints: [{ id: 'muzzle', x: 0.8, y: 0.2 }],
      clips: [{ name: 'idle', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true }],
    },
  }
  p.audioAssets = {
    aud_theme: {
      id: 'aud_theme', name: 'theme.ogg', path: 'assets/audio/theme.ogg',
      contentHash: 'hash_theme', category: 'music', volume: 0.4,
    },
  }
  p.fontAssets = {
    font_main: {
      id: 'font_main', name: 'main.ttf', path: 'assets/fonts/main.ttf',
      contentHash: 'hash_font', defaultSize: 24,
    },
  }
  p.tilesets = {
    ts_grass: {
      assetId: 'ts_grass', name: 'grass', spriteImagePath: 'assets/tilesets/grass.png',
      contentHash: 'hash_tileset', tileSize: 16, margin: 1, cols: 8, rows: 8,
    },
  }
  p.assetVirtualFolders = {
    fld_1: {
      id: 'fld_1', name: 'Heroes', category: 'images', usage: 'sprite',
      assetRefs: [{ type: 'image', id: 'img_hero' }],
    },
  }
  p.tilePalette = [
    {
      id: 1,
      name: 'Dirt',
      color: '#8B5A2B',
      collisionBody: {
        bodyType: 'static',
        enabled: true,
        shapes: [{
          type: 'rectangle',
          response: 'solid',
          role: 'body',
          layerId: 'ground',
          maskLayerIds: ['player'],
          offsetX: 0,
          offsetY: 0,
          width: 32,
          height: 32,
          radius: 16,
          enabled: true,
          oneWay: false,
          friction: 0.3,
          restitution: 0,
          density: 1,
        }],
      },
    },
  ]
  p.globalVariables = [
    { key: 'score', type: 'number', initialValue: 0 },
    { key: 'paused', type: 'boolean', initialValue: false },
  ]
  p.layers = [
    { id: 'lyr_fg', name: 'Foreground', locked: true },
    { id: 'lyr_mid', name: 'Midground' },
    { id: 'lyr_bg', name: 'Background' },
  ]
  p.thumbnails = { scene_main: 'data:image/png;base64,AAAA' }
  p.world = { gravity: 9.8, pixelsPerMeter: 32, timeScale: 1, physicsMode: 'on' }
  return p
}

describe('project-codec round-trip', () => {
  const back = parseProjectDoc(serializeProjectDoc(richProject()))!

  it('parses back to a non-null project', () => {
    expect(back).not.toBeNull()
  })

  it('preserves object types, including ones with no placed instances', () => {
    expect(Object.keys(back.objectTypes ?? {}).sort()).toEqual(['Hero', 'Pickup'])
    expect(back.objectTypes?.Hero.scriptPath).toBe('scripts/hero.lua')
    expect(back.objectTypes?.Hero.visible).toBe(false)
    expect(back.objectTypes?.Hero.defaultLogicBoardId).toBe('board_hero')
    expect(back.objectTypes?.Hero.tags).toEqual(['player', 'mortal'])
  })

  it('preserves object-type sprite detail', () => {
    const s = back.objectTypes?.Hero.sprite
    expect(s?.spriteAssetId).toBe('img_hero')
    expect(s?.pivotFromAsset).toBe(false)
    expect(s?.pivot).toEqual({ x: 0.25, y: 0.75 })
    expect(s?.defaultClip).toBe('idle')
    expect(s?.playClipOnSpawn).toBe(true)
    expect(s?.renderOrder).toBe(5)
    expect(s?.tint).toEqual({ x: 0.5, y: 0.6, z: 0.7, w: 0.8 })
  })

  it('preserves object-type physics and local variables', () => {
    expect(back.objectTypes?.Hero.physics?.bodyType).toBe('Dynamic')
    expect(back.objectTypes?.Hero.physics?.collider.shape).toBe('Rectangle')
    expect(back.objectTypes?.Hero.localVariables).toEqual([
      { key: 'hp', type: 'number', initialValue: 100, description: 'health' },
      { key: 'name', type: 'string', initialValue: 'Knight' },
    ])
  })

  it('preserves scene instances with overrides and placement', () => {
    const inst = back.scenes.scene_main.instances?.[0]
    expect(inst?.objectTypeId).toBe('Hero')
    expect(inst?.instanceName).toBe('Hero #1')
    expect(inst?.visible).toBe(false)
    expect(inst?.layerId).toBe('lyr_mid')
    expect(back.entities[1]?.layerId).toBe('lyr_mid')
    expect(inst?.localVariableOverrides).toEqual({ hp: 50, name: 'Override' })
    expect(inst?.transform.position).toEqual({ x: 40, y: 80 })
    expect(inst?.transform.scale).toEqual({ x: 2, y: 2 })
    expect(inst?.transform.rotation).toBe(1.5)
  })

  it('preserves tilemap source data', () => {
    const tm = back.scenes.scene_main.tilemap
    expect(tm?.data).toEqual([0, 1, 2, 3, 0, 1])
    expect(tm?.defaultTilesetAssetId).toBe('ts_grass')
    expect(tm?.tilesetSources).toEqual([{ tilesetAssetId: 'ts_grass' }])
  })

  it('preserves image asset points, clips and default pivot', () => {
    const a = back.assets?.img_hero
    expect(a?.defaultPivot).toEqual({ x: 0.5, y: 1 })
    expect(a?.contentHash).toBe('hash_hero')
    expect(a?.imagePoints).toEqual([{ id: 'muzzle', x: 0.8, y: 0.2 }])
    expect(a?.clips?.[0]?.name).toBe('idle')
  })

  it('preserves audio, font, tileset and virtual folders', () => {
    expect(back.audioAssets?.aud_theme).toMatchObject({
      contentHash: 'hash_theme',
      category: 'music',
      volume: 0.4,
    })
    expect(back.fontAssets?.font_main?.defaultSize).toBe(24)
    expect(back.fontAssets?.font_main?.contentHash).toBe('hash_font')
    expect(back.tilesets?.ts_grass?.spriteImagePath).toBe('assets/tilesets/grass.png')
    expect(back.tilesets?.ts_grass?.contentHash).toBe('hash_tileset')
    expect(back.assetVirtualFolders?.fld_1?.assetRefs).toEqual([{ type: 'image', id: 'img_hero' }])
  })

  it('preserves palette, globals, layers, world and license tier', () => {
    expect(back.tilePalette?.[0]).toMatchObject({ id: 1, name: 'Dirt' })
    expect(back.tilePalette?.[0].collisionBody?.shapes[0]).toMatchObject({
      response: 'solid',
      layerId: 'ground',
    })
    expect(back.globalVariables).toEqual([
      { key: 'score', type: 'number', initialValue: 0 },
      { key: 'paused', type: 'boolean', initialValue: false },
    ])
    expect(back.layers).toEqual([
      { id: 'lyr_fg', name: 'Foreground', locked: true },
      { id: 'lyr_mid', name: 'Midground' },
      { id: 'lyr_bg', name: 'Background' },
    ])
    expect(back.scenes.scene_main.layerSettings).toEqual({
      lyr_fg: { visible: false, opacity: 0.65, parallax: { x: 1.4, y: 1.2 } },
      lyr_bg: {
        parallax: { x: 0.3, y: 0.5 },
        background: { imageId: 'img_sky', tileX: true, tileY: false, scrollX: 10, scrollY: 0 },
      },
    })
    expect(back.world).toMatchObject({ physicsMode: 'on', gravity: 9.8 })
    expect(back.licenseTier).toBe('pro')
    expect(back.thumbnails?.scene_main).toContain('data:image/png')
  })
})
