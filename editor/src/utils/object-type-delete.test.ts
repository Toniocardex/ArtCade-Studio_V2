import { describe, expect, it } from 'vitest'
import { deleteObjectTypeCascade } from './object-type-delete'
import { createLogicBoardForObjectType } from './logic-board/factory'
import type { ProjectDoc } from '../types'

function sampleProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '1',
    targetFPS: 60,
    activeSceneId: 'main',
    mainScriptPath: 'main.lua',
    objectTypes: {
      enemy: {
        id: 'enemy',
        displayName: 'Enemy',
        tags: [],
        sprite: { spriteAssetId: 'gen_proto_enemy' },
      },
      coin: {
        id: 'coin',
        displayName: 'Coin',
        tags: [],
        sprite: {},
      },
    },
    assets: {
      gen_proto_enemy: {
        id: 'gen_proto_enemy',
        path: 'generated/enemy.png',
        generated: { temporary: true, objectTypeId: 'enemy' },
      },
    },
    entities: {
      1: { id: 1, name: 'Enemy', className: 'Enemy', tags: [], transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 }, sprite: {} },
      2: { id: 2, name: 'Enemy_2', className: 'Enemy', tags: [], transform: { position: { x: 10, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 }, sprite: {} },
      3: { id: 3, name: 'Enemy', className: 'Enemy', tags: [], transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 }, sprite: {} },
      9: { id: 9, name: 'Coin', className: 'Coin', tags: [], transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 }, sprite: {} },
    },
    logicBoards: [
      createLogicBoardForObjectType('enemy'),
      createLogicBoardForObjectType('coin'),
    ],
    scenes: {
      main: {
        id: 'main',
        name: 'Main',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        entityIds: [1, 9],
        instances: [
          { id: 1, objectTypeId: 'enemy', transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } },
          { id: 9, objectTypeId: 'coin', transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } },
        ],
      },
      level2: {
        id: 'level2',
        name: 'Level 2',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        entityIds: [2, 3],
        instances: [
          { id: 2, objectTypeId: 'enemy', transform: { position: { x: 10, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } },
          { id: 3, objectTypeId: 'enemy', transform: { position: { x: 20, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } },
        ],
      },
    },
  }
}

describe('deleteObjectTypeCascade', () => {
  it('removes the type, all instances, entities, boards, and generated prototype', () => {
    const { project, deletedEntityIds } = deleteObjectTypeCascade(sampleProject(), 'enemy')

    expect(deletedEntityIds.sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect(project.objectTypes?.enemy).toBeUndefined()
    expect(project.entities[1]).toBeUndefined()
    expect(project.entities[2]).toBeUndefined()
    expect(project.entities[3]).toBeUndefined()
    expect(project.entities[9]).toBeDefined()
    expect(project.scenes.main.instances).toHaveLength(1)
    expect(project.scenes.level2.instances).toHaveLength(0)
    expect(project.logicBoards?.some((board) => board.target.objectTypeId === 'enemy')).toBe(false)
    expect(project.logicBoards?.some((board) => board.target.objectTypeId === 'coin')).toBe(true)
    expect(project.assets?.gen_proto_enemy).toBeUndefined()
  })

  it('returns the original project when the type is missing', () => {
    const project = sampleProject()
    const result = deleteObjectTypeCascade(project, 'missing')

    expect(result.project).toBe(project)
    expect(result.deletedEntityIds).toEqual([])
  })
})
