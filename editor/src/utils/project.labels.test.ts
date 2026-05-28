import { describe, expect, it } from 'vitest'
import {
  allEntityTags,
  classDisplayLabel,
  entityIdDisplayLabel,
  findLogicBoardForEntity,
  logicBoardLabel,
  logicBoardsForScene,
  rulesheetAppliesToLabel,
} from './project'
import { createBlankProject } from './project-factory'
import { createEntityDef } from './project-builders'
import {
  createLogicBoardForEntity,
  createLogicBoardForObjectType,
} from './logic-board/factory'
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

describe('findLogicBoardForEntity', () => {
  it('returns board bound to entity_id', () => {
    const project = {
      ...miniProject(),
      logicBoards: [createLogicBoardForEntity(2, 'b2')],
    }
    expect(findLogicBoardForEntity(project, 2)?.boardId).toBe('b2')
    expect(findLogicBoardForEntity(project, 1)).toBeUndefined()
  })
})

describe('rulesheetAppliesToLabel', () => {
  it('names a single entity_id rulesheet after the instance', () => {
    const board = createLogicBoardForEntity(1, 'b1')
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
      createLogicBoardForEntity(2, 'b_ent2'),
    ]
    const ids = logicBoardsForScene(project, 'scene_main').map((b) => b.boardId)
    expect(ids).toEqual(['b_player', 'b_ent2'])
  })
})

describe('logicBoardLabel', () => {
  it('prefers custom rulesheet names', () => {
    const board = createLogicBoardForEntity(1, 'b1', 'Player controls')
    expect(logicBoardLabel(miniProject(), board)).toBe('Player controls')
  })

  it('uses the generated compiler label for new entity_id boards', () => {
    const board = createLogicBoardForEntity(1, 'board_mplj6t76_1')
    expect(logicBoardLabel(miniProject(), board)).toBe('board_mplj6t76_1')
  })

  it('falls back to boardId for existing boards without names', () => {
    expect(logicBoardLabel(miniProject(), {
      boardId: 'old_board',
      target: { type: 'entity_class', className: 'Enemy' },
      events: [],
    })).toBe('old_board')
  })
})

describe('allEntityTags', () => {
  it('collects entity tags and sensor targetTag values', () => {
    const project = miniProject()
    project.entities[1].tags = ['player', 'controllable']
    project.entities[4] = {
      ...project.entities[1],
      id: 4,
      name: 'Coin',
      className: 'Coin',
      tags: ['pickup'],
      sensor: { shape: 'Circle', radius: 30, width: 64, height: 64, targetTag: 'player' },
    }
    expect(allEntityTags(project)).toEqual(['controllable', 'pickup', 'player'])
  })
})
