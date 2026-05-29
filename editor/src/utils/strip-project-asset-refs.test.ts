import { describe, it, expect } from 'vitest'
import type { ProjectDoc } from '../types'
import type { LogicBoard } from '../types/logic-board'
import { projectAfterRemovingAsset } from './strip-project-asset-refs'

function baseProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1,
        name: 'A',
        className: 'Player',
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
      },
    },
    scenes: {
      s: {
        id: 's',
        name: 'S',
        worldSize: { x: 640, y: 320 },
        viewportSize: { x: 640, y: 320 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [1],
        tilemap: { tilesetAssetId: 'ts_a', cols: 10, rows: 5, tileSize: 32, layers: [] },
      },
    },
    assets: {
      img_a: { id: 'img_a', name: 'hero.png', path: 'assets/images/hero.png' },
    },
    audioAssets: {
      sfx_a: { id: 'sfx_a', name: 'coin.ogg', path: 'assets/audio/coin.ogg', category: 'sfx' },
    },
    fontAssets: {
      f1: { id: 'f1', name: 'UI.ttf', path: 'assets/fonts/ui.ttf', defaultSize: 24 },
    },
    tilesets: {
      ts_a: {
        assetId: 'ts_a',
        name: 'Tiles',
        imageAssetId: 'img_a',
        tileSize: 32,
        cols: 10,
        rows: 5,
        tiles: [],
      },
    },
  }
}

const boardWithAudio: LogicBoard = {
  boardId: 'b1',
  name: 'Test',
  target: { type: 'scene', sceneId: 's' },
  events: [
    {
      id: 'e1',
      trigger: { type: 'onStart' },
      actions: [
        { type: 'playSound', audioAssetId: 'sfx_a', volume: 1 },
        { type: 'playMusic', path: 'assets/audio/coin.ogg', loop: true },
      ],
    },
  ],
}

describe('projectAfterRemovingAsset', () => {
  it('image: removes asset and clears entity sprite path', () => {
    const p = baseProject()
    const next = projectAfterRemovingAsset(p, {
      kind: 'image',
      id: 'img_a',
      path: 'assets/images/hero.png',
    })
    expect(next.assets).toEqual({})
    expect(next.entities[1].sprite.spriteAssetId).toBe('')
  })

  it('audio: removes library entry and scrubs logic board actions', () => {
    const p = { ...baseProject(), logicBoards: [boardWithAudio] }
    const next = projectAfterRemovingAsset(p, {
      kind: 'audio',
      id: 'sfx_a',
      path: 'assets/audio/coin.ogg',
    })
    expect(next.audioAssets).toEqual({})
    const actions = next.logicBoards![0].events[0].actions
    expect(actions[0]).toEqual({ type: 'playSound', volume: 1 })
    expect(actions[1]).toEqual({ type: 'playMusic', loop: true })
  })

  it('font: removes font entry only', () => {
    const p = baseProject()
    const next = projectAfterRemovingAsset(p, {
      kind: 'font',
      id: 'f1',
      path: 'assets/fonts/ui.ttf',
    })
    expect(next.fontAssets).toEqual({})
    expect(next.entities[1].sprite.spriteAssetId).toBe('assets/images/hero.png')
  })

  it('tileset: removes tileset and detaches scene tilemap', () => {
    const p = baseProject()
    const next = projectAfterRemovingAsset(p, { kind: 'tileset', id: 'ts_a' })
    expect(next.tilesets).toEqual({})
    expect(next.scenes.s.tilemap?.tilesetAssetId).toBeUndefined()
    expect(next.scenes.s.tilemap?.cols).toBe(10)
  })
})
