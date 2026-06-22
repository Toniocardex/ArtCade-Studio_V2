import { describe, expect, it } from 'vitest'
import type { LogicBoard } from '../types/logic-board'
import type { ProjectDoc } from '../types'
import { listProjectClips } from './animation-clips-catalog'
import {
  resolveClipContextForLogicBoard,
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

  it('surfaces clips from a duplicate asset entry for the same sheet (path/name)', () => {
    // Object references entry A (1 clip); the same image was also imported as
    // entry B with a different path but the same filename, holding more clips.
    const project = miniProject({
      a: {
        id: 'a',
        name: 'walking.png',
        path: 'walking.png',
        clips: [{ name: 'walking', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true }],
      },
      b: {
        id: 'b',
        name: 'walking.png',
        path: 'sprites/walking.png',
        clips: [
          { name: 'idle', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true },
          { name: 'run', frames: [{ x: 16, y: 0, w: 16, h: 16 }], fps: 12, loop: true },
        ],
      },
    })
    const rows = listProjectClips(project, 'walking.png')
    expect(rows.map((r) => r.clipName).sort()).toEqual(['idle', 'run', 'walking'])
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

describe('resolveClipContextForLogicBoard (re-exported spritePathForLogicBoardTarget)', () => {
  it('returns sprite path for object_type boards', () => {
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
  })

  it('lists ALL clips on the object sheet for the play-animation picker', () => {
    const project: ProjectDoc = {
      ...miniProject({
        sheet: {
          id: 'sheet',
          name: 'walking.png',
          path: 'assets/walking.png',
          clips: [
            { name: 'idle', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true },
            { name: 'walk', frames: [{ x: 16, y: 0, w: 16, h: 16 }], fps: 8, loop: true },
            { name: 'run', frames: [{ x: 32, y: 0, w: 16, h: 16 }], fps: 12, loop: true },
          ],
        },
      }),
      entities: {
        1: {
          id: 1,
          name: 'Obj',
          className: 'Object',
          tags: [],
          transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
          sprite: {
            spriteAssetId: 'assets/walking.png',
            tint: { x: 1, y: 1, z: 1, w: 1 },
            fillColor: { x: 1, y: 1, z: 1 },
            alpha: 1,
            pivot: { x: 0.5, y: 0.5 },
            renderOrder: 0,
            defaultClip: 'idle',
          },
        },
      },
    }
    const board: LogicBoard = {
      id: 'b',
      name: 'Object rules',
      target: { type: 'object_type', objectTypeId: 'Object' },
      events: [],
    }
    const ctx = resolveClipContextForLogicBoard(project, board)
    const rows = listProjectClips(project, ctx.spritePath)
    expect(rows.map((r) => r.clipName).sort()).toEqual(['idle', 'run', 'walk'])
  })

  it('lists ALL sheet clips through object-type + scene-instance materialization', () => {
    const sprite = {
      spriteAssetId: 'assets/walking.png',
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
      defaultClip: 'idle',
    }
    const project: ProjectDoc = {
      ...miniProject({
        sheet: {
          id: 'sheet',
          name: 'walking.png',
          path: 'assets/walking.png',
          clips: [
            { name: 'idle', frames: [{ x: 0, y: 0, w: 16, h: 16 }], fps: 8, loop: true },
            { name: 'walk', frames: [{ x: 16, y: 0, w: 16, h: 16 }], fps: 8, loop: true },
            { name: 'run', frames: [{ x: 32, y: 0, w: 16, h: 16 }], fps: 12, loop: true },
          ],
        },
      }),
      objectTypes: {
        Object: { id: 'Object', displayName: 'Object', tags: [], sprite } as never,
      },
      scenes: {
        s: {
          id: 's',
          name: 'Main',
          worldSize: { x: 100, y: 100 },
          viewportSize: { x: 100, y: 100 },
          backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
          entityIds: [1],
          instances: [
            {
              id: 1,
              objectTypeId: 'Object',
              transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
              visible: true,
            },
          ],
        } as never,
      },
    }
    const board: LogicBoard = {
      id: 'b',
      name: 'Object rules',
      target: { type: 'object_type', objectTypeId: 'Object' },
      events: [],
    }
    const ctx = resolveClipContextForLogicBoard(project, board)
    const rows = listProjectClips(project, ctx.spritePath)
    expect(rows.map((r) => r.clipName).sort()).toEqual(['idle', 'run', 'walk'])
  })

  it('returns undefined for global boards', () => {
    const board: LogicBoard = {
      id: 'g',
      name: 'Global',
      target: { type: 'global' },
      events: [],
    }
    expect(spritePathForLogicBoardTarget(miniProject({}), board)).toBeUndefined()
    expect(resolveClipContextForLogicBoard(miniProject({}), board)).toEqual({})
  })
})
