import { describe, expect, it } from 'vitest'
import type { ProjectDoc } from '../types'
import type { LogicBoard } from '../types/logic-board'
import {
  normalizeSpriteClipFields,
  resolveClipContextForLogicBoard,
  resolveClipForEntity,
  spritePathForLogicBoardTarget,
} from './entity-clip-resolve'

function miniProject(assets: ProjectDoc['assets']): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {},
    scenes: {},
    assets,
  }
}

describe('resolveClipForEntity', () => {
  it('returns validated defaultClip and clips for the entity sheet', () => {
    const project = miniProject({
      a: {
        id: 'a',
        name: 'hero.png',
        path: 'assets/hero.png',
        clips: [
          { name: 'walk', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true },
          { name: 'idle', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true },
        ],
      },
    })
    const entity = {
      id: 1,
      name: 'Hero',
      className: 'Player',
      tags: [],
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite: {
        spriteAssetId: 'assets/hero.png',
        tint: { x: 1, y: 1, z: 1, w: 1 },
        fillColor: { x: 1, y: 1, z: 1 },
        alpha: 1,
        pivot: { x: 0.5, y: 0.5 },
        renderOrder: 0,
        defaultClip: 'walk',
        playClipOnSpawn: true,
      },
    }
    project.entities[1] = entity
    const r = resolveClipForEntity(project, 1, entity)
    expect(r?.spritePath).toBe('assets/hero.png')
    expect(r?.defaultClip).toBe('walk')
    expect(r?.playClipOnSpawn).toBe(true)
    expect(r?.clips.map((c) => c.name)).toEqual(['walk', 'idle'])
  })

  it('drops defaultClip when it is missing on the assigned sheet', () => {
    const project = miniProject({
      a: {
        id: 'a',
        name: 'hero.png',
        path: 'assets/hero.png',
        clips: [{ name: 'run', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true }],
      },
    })
    const entity = {
      id: 1,
      name: 'Hero',
      className: 'Player',
      tags: [],
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite: {
        spriteAssetId: 'assets/hero.png',
        tint: { x: 1, y: 1, z: 1, w: 1 },
        fillColor: { x: 1, y: 1, z: 1 },
        alpha: 1,
        pivot: { x: 0.5, y: 0.5 },
        renderOrder: 0,
        defaultClip: 'walk',
        playClipOnSpawn: true,
      },
    }
    const r = resolveClipForEntity(project, 1, entity)
    expect(r?.defaultClip).toBeUndefined()
    expect(r?.playClipOnSpawn).toBe(false)
  })
})

describe('normalizeSpriteClipFields', () => {
  it('matches resolveClipForEntity clip normalization', () => {
    const project = miniProject({
      a: {
        id: 'a',
        name: 'x.png',
        path: 'x.png',
        clips: [{ name: 'a', frames: [{ x: 0, y: 0, w: 1, h: 1 }], fps: 8, loop: true }],
      },
    })
    const sprite = {
      spriteAssetId: 'x.png',
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
      defaultClip: 'a',
      playClipOnSpawn: true,
    }
    expect(normalizeSpriteClipFields(sprite, project)).toEqual({
      defaultClip: 'a',
      playClipOnSpawn: true,
    })
  })
})

describe('resolveClipContextForLogicBoard', () => {
  it('returns spritePath for object_type boards', () => {
    const project: ProjectDoc = {
      ...miniProject({}),
      entities: {
        1: {
          id: 1,
          name: 'Hero',
          className: 'Player',
          tags: [],
          transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
          sprite: {
            spriteAssetId: 'assets/hero.png',
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
          },
        },
      },
    }
    const board: LogicBoard = {
      id: 'b1',
      name: 'Hero rules',
      target: { type: 'object_type', objectTypeId: 'Player' },
      events: [],
    }
    expect(spritePathForLogicBoardTarget(project, board)).toBe('assets/hero.png')
    expect(resolveClipContextForLogicBoard(project, board)).toEqual({
      spritePath: 'assets/hero.png',
    })
  })

  it('flags ambiguous sprite paths when instances disagree', () => {
    const project: ProjectDoc = {
      ...miniProject({
        hero: { id: 'hero', name: 'hero.png', path: 'assets/hero.png' },
        enemy: { id: 'enemy', name: 'enemy.png', path: 'assets/enemy.png' },
      }),
      objectTypes: {
        Mixed: {
          id: 'Mixed',
          displayName: 'Mixed',
          tags: [],
          sprite: {
            spriteAssetId: 'assets/hero.png',
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
          name: 'Main',
          worldSize: { x: 800, y: 600 },
          viewportSize: { x: 800, y: 600 },
          backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
          entityIds: [1, 2],
          instances: [
            {
              id: 1,
              objectTypeId: 'Mixed',
              transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
            },
            {
              id: 2,
              objectTypeId: 'Mixed',
              transform: { position: { x: 10, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
            },
          ],
        },
      },
      entities: {
        2: {
          id: 2,
          name: 'Alt',
          className: 'Mixed',
          tags: [],
          transform: { position: { x: 10, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
          sprite: {
            spriteAssetId: 'assets/enemy.png',
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
          },
        },
      },
    }
    const board: LogicBoard = {
      id: 'mixed',
      name: 'Mixed rules',
      target: { type: 'object_type', objectTypeId: 'Mixed' },
      events: [],
    }
    expect(resolveClipContextForLogicBoard(project, board)).toEqual({
      ambiguousSpritePath: true,
    })
    expect(spritePathForLogicBoardTarget(project, board)).toBeUndefined()
  })
})
