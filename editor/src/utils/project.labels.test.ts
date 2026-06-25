import { describe, expect, it } from 'vitest'
import {
  allEntityTags,
  classDisplayLabel,
  entityIdDisplayLabel,
  findLogicBoardForObjectType,
  logicBoardLabel,
  logicBoardsForScene,
  rulesheetAppliesToLabel,
} from './project'
import { createBlankProject } from './project-factory'
import { createEntityDef } from './project-builders'
import { createLogicBoardForObjectType } from './logic-board/factory'
import type { ProjectDoc } from '../types'

function miniProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1, name: 'Hero', className: 'Player', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
      2: {
        id: 2, name: 'Patrol_A', className: 'Enemy', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
      3: {
        id: 3, name: 'Patrol_B', className: 'Enemy', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
    },
    scenes: {
      s: {
        id: 's', name: 'S', worldSize: { x: 1280, y: 720 }, viewportSize: { x: 1280, y: 720 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1, 2, 3],
      },
    },
  }
}

describe('classDisplayLabel', () => {
  const project = miniProject()

  it('shows renamed instance for a single-entity class', () => {
    expect(classDisplayLabel(project, 'Player')).toBe('Hero (Player)')
  })

  it('lists entity names for a shared class', () => {
    expect(classDisplayLabel(project, 'Enemy')).toBe('Enemy — Patrol_A, Patrol_B')
  })

  it('falls back to class when project missing', () => {
    expect(classDisplayLabel(null, 'Coin')).toBe('Coin')
  })
})

describe('entityIdDisplayLabel', () => {
  it('uses hierarchy entity name only', () => {
    expect(entityIdDisplayLabel(miniProject(), 2)).toBe('Patrol_A')
  })
})

describe('findLogicBoardForObjectType', () => {
  it('returns the board bound to a type and undefined otherwise', () => {
    const project = {
      ...miniProject(),
      logicBoards: [createLogicBoardForObjectType('Enemy', 'b2')],
    }
    expect(findLogicBoardForObjectType(project, 'Enemy')?.boardId).toBe('b2')
    expect(findLogicBoardForObjectType(project, 'Player')).toBeUndefined()
  })
})

describe('rulesheetAppliesToLabel', () => {
  it('names a single-instance type rulesheet after the instance', () => {
    const board = createLogicBoardForObjectType('Player', 'b1')
    expect(rulesheetAppliesToLabel(miniProject(), board)).toBe('Hero')
  })

  it('lists scene instances for legacy Entity_* object type boards', () => {
    const project = createBlankProject('T')
    project.entities[1] = createEntityDef(1, 'Entity_1', 'Entity', { x: 0, y: 0 })
    project.scenes.scene_main.entityIds = [1]
    const board = createLogicBoardForObjectType('Entity_1', 'b_legacy')
    expect(rulesheetAppliesToLabel(project, board)).toBe('Entity_1')
  })
})

describe('logicBoardsForScene', () => {
  it('returns boards that touch entities in the active scene', () => {
    const project = createBlankProject('T')
    project.entities[1] = createEntityDef(1, 'Hero', 'Player', { x: 0, y: 0 })
    project.entities[2] = createEntityDef(2, 'Entity_2', 'Entity', { x: 10, y: 0 })
    project.scenes.scene_main.entityIds = [1, 2]
    project.logicBoards = [
      createLogicBoardForObjectType('Player', 'b_player'),
      createLogicBoardForObjectType('Entity_2', 'b_ent2'),
    ]
    const ids = logicBoardsForScene(project, 'scene_main').map((b) => b.boardId)
    expect(ids).toEqual(['b_player', 'b_ent2'])
  })
})

describe('logicBoardLabel', () => {
  it('prefers custom rulesheet names', () => {
    const board = createLogicBoardForObjectType('Player', 'b1', 'Player controls')
    expect(logicBoardLabel(miniProject(), board)).toBe('Player controls')
  })

  it('derives a human name from the object type for new boards', () => {
    const board = createLogicBoardForObjectType('Player', 'board_mplj6t76_1')
    expect(logicBoardLabel(miniProject(), board)).toBe('Player rules')
  })

  it('falls back to boardId for existing boards without names', () => {
    expect(logicBoardLabel(miniProject(), {
      boardId: 'old_board',
      target: { type: 'object_type', objectTypeId: 'Enemy' },
      events: [],
    })).toBe('old_board')
  })
})

describe('allEntityTags', () => {
  it('collects entity tags', () => {
    const project = miniProject()
    project.entities[1].tags = ['player', 'controllable']
    project.entities[4] = {
      ...project.entities[1],
      id: 4,
      name: 'Coin',
      className: 'Coin',
      tags: ['pickup'],
    }
    expect(allEntityTags(project)).toEqual(['controllable', 'pickup', 'player'])
  })
})
