import { describe, expect, it } from 'vitest'
import {
  allEntityTags,
  classDisplayLabel,
  entityIdDisplayLabel,
  findLogicBoardForEntity,
  logicBoardLabel,
} from './project'
import { createLogicBoard, createLogicBoardForEntity } from './logic-board/factory'
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
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
      2: {
        id: 2, name: 'Patrol_A', className: 'Enemy', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
      3: {
        id: 3, name: 'Patrol_B', className: 'Enemy', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
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

describe('logicBoardLabel', () => {
  it('shows entity name for entity_id boards', () => {
    const board = createLogicBoardForEntity(1)
    expect(logicBoardLabel(miniProject(), board)).toBe('Hero')
  })

  it('prefixes class boards for advanced shared rules', () => {
    const board = createLogicBoard('Enemy')
    expect(logicBoardLabel(miniProject(), board)).toContain('[class]')
    expect(logicBoardLabel(miniProject(), board)).toContain('Enemy')
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
