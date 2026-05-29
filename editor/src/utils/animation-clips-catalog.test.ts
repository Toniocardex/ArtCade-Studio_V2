import { describe, expect, it } from 'vitest'
import type { ProjectDoc } from '../types'
import type { LogicBoard } from '../types/logic-board'
import {
  listProjectClips,
  spritePathForLogicBoardTarget,
} from './animation-clips-catalog'

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

describe('listProjectClips', () => {
  it('lists clips from all image assets with distinct rows for duplicate names', () => {
    const project = miniProject({
      a: {
        id: 'a',
        name: 'hero.png',
        path: 'assets/hero.png',
        clips: [{ name: 'walk', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true }],
      },
      b: {
        id: 'b',
        name: 'enemy.png',
        path: 'assets/enemy.png',
        clips: [{ name: 'walk', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 6, loop: true }],
      },
    })
    const rows = listProjectClips(project)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.clipName === 'walk')).toBe(true)
    expect(new Set(rows.map((r) => r.assetId)).size).toBe(2)
  })

  it('skips empty names and frameless clips', () => {
    const project = miniProject({
      a: {
        id: 'a',
        name: 'x.png',
        path: 'x.png',
        clips: [
          { name: '', frames: [{ x: 0, y: 0, w: 1, h: 1 }], fps: 8, loop: true },
          { name: 'idle', frames: [], fps: 8, loop: true },
        ],
      },
    })
    expect(listProjectClips(project)).toHaveLength(0)
  })

  it('filters by sprite path when provided', () => {
    const project = miniProject({
      a: {
        id: 'a',
        name: 'hero.png',
        path: 'assets/hero.png',
        clips: [{ name: 'walk', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true }],
      },
      b: {
        id: 'b',
        name: 'enemy.png',
        path: 'assets/enemy.png',
        clips: [{ name: 'idle', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 6, loop: true }],
      },
    })
    const rows = listProjectClips(project, 'assets/hero.png')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.clipName).toBe('walk')
  })
})

describe('spritePathForLogicBoardTarget', () => {
  it('returns sprite path for entity_id boards', () => {
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
      target: { type: 'entity_id', entityId: 1 },
      events: [],
    }
    expect(spritePathForLogicBoardTarget(project, board)).toBe('assets/hero.png')
  })

  it('returns undefined for global boards', () => {
    const board: LogicBoard = {
      id: 'g',
      name: 'Global',
      target: { type: 'global' },
      events: [],
    }
    expect(spritePathForLogicBoardTarget(miniProject({}), board)).toBeUndefined()
  })
})
