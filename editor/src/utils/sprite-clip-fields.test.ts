import { describe, expect, it } from 'vitest'
import { parseProjectDoc } from './project-codec'
import { spriteAssignedFromAsset } from './sprite-pivot-resolve'
import type { EntityDef, ImageAsset, ProjectDoc } from '../types'

const baseEntity = (): EntityDef => ({
  id: 1,
  name: 'Hero',
  className: 'Player',
  tags: [],
  transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
  sprite: {
    spriteAssetId: 'old.png',
    tint: { x: 1, y: 1, z: 1, w: 1 },
    fillColor: { x: 1, y: 1, z: 1 },
    alpha: 1,
    pivot: { x: 0.5, y: 0.5 },
    renderOrder: 0,
    defaultClip: 'walk',
    playClipOnSpawn: true,
  },
})

describe('sprite clip fields', () => {
  it('parses defaultClip and playClipOnSpawn on entity sprite JSON', () => {
    const doc = parseProjectDoc(
      JSON.stringify({
        projectName: 'T',
        version: '2.0.0',
        targetFPS: 60,
        activeSceneId: 's',
        mainScriptPath: 'scripts/main.lua',
        entities: {
          '1': {
            id: 1,
            name: 'Hero',
            className: 'Player',
            tags: [],
            transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
            sprite: {
              spriteAssetId: 'hero.png',
              tint: [1, 1, 1, 1],
              alpha: 1,
              renderOrder: 0,
              defaultClip: 'walk',
              playClipOnSpawn: true,
            },
          },
        },
        scenes: {
          s: {
            id: 's',
            name: 'Main',
            worldSize: [800, 600],
            viewportSize: [800, 600],
            backgroundColor: [0, 0, 0, 1],
            entityIds: [1],
          },
        },
      }),
    )!
    const ent = doc.entities[1]
    expect(ent?.sprite.defaultClip).toBe('walk')
    expect(ent?.sprite.playClipOnSpawn).toBe(true)
  })

  it('migrates legacy animation.currentAnim to sprite.defaultClip', () => {
    const raw = {
      projectName: 'T',
      version: '2.0.0',
      targetFPS: 60,
      activeSceneId: 's',
      mainScriptPath: 'scripts/main.lua',
      entities: {
        '1': {
          id: 1,
          name: 'E',
          className: 'Player',
          tags: [],
          transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
          sprite: { spriteAssetId: 'a.png', tint: [1, 1, 1, 1], alpha: 1, renderOrder: 0 },
          animation: { currentAnim: 'idle', currentFrame: 0, frameDuration: 0.1, isPlaying: false, isLooping: true },
        },
      },
      scenes: {},
    }
    const doc = parseProjectDoc(JSON.stringify(raw))!
    const proto = doc.objectTypes?.Player ?? doc.entities[1]
    expect(proto?.sprite.defaultClip).toBe('idle')
    expect(proto && 'animation' in proto ? proto.animation : undefined).toBeUndefined()
  })

  it('clears defaultClip when assigning a sheet without that clip', () => {
    const asset: ImageAsset = {
      id: 'b',
      name: 'other.png',
      path: 'other.png',
      clips: [{ name: 'run', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true }],
    }
    const project: ProjectDoc = {
      projectName: 'T',
      version: '2.0.0',
      targetFPS: 60,
      activeSceneId: 's',
      mainScriptPath: 'scripts/main.lua',
      entities: {},
      scenes: {},
      assets: { b: asset },
    }
    const next = spriteAssignedFromAsset(baseEntity().sprite, asset, project)
    expect(next.spriteAssetId).toBe('other.png')
    expect(next.defaultClip).toBeUndefined()
    expect(next.playClipOnSpawn).toBe(false)
  })
})
