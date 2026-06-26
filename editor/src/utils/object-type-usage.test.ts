import { describe, expect, it } from 'vitest'
import {
  findObjectTypeByDisplayName,
  objectTypeInstanceCountInScene,
  countObjectTypeInstances,
} from './object-type-usage'
import type { ProjectDoc } from '../types'

function sampleProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '1',
    targetFPS: 60,
    activeSceneId: 'main',
    mainScriptPath: 'main.lua',
    entities: {},
    objectTypes: {
      coin: { id: 'coin', displayName: 'Coin', tags: [], sprite: {} },
    },
    scenes: {
      main: {
        id: 'main',
        name: 'Main',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        entityIds: [1, 2],
        instances: [
          { id: 1, objectTypeId: 'coin', transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } },
          { id: 2, objectTypeId: 'coin', transform: { position: { x: 10, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } },
        ],
      },
      other: {
        id: 'other',
        name: 'Other',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        entityIds: [3],
        instances: [
          { id: 3, objectTypeId: 'coin', transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 } },
        ],
      },
    },
  }
}

describe('object-type-usage', () => {
  it('counts instances across all scenes', () => {
    expect(countObjectTypeInstances(sampleProject(), 'coin')).toBe(3)
    expect(countObjectTypeInstances(sampleProject(), 'missing')).toBe(0)
  })

  it('counts instances in one scene', () => {
    expect(objectTypeInstanceCountInScene(sampleProject(), 'main', 'coin')).toBe(2)
    expect(objectTypeInstanceCountInScene(sampleProject(), 'other', 'coin')).toBe(1)
  })

  it('finds object types by display name', () => {
    expect(findObjectTypeByDisplayName(sampleProject(), 'coin')?.id).toBe('coin')
    expect(findObjectTypeByDisplayName(sampleProject(), 'COIN')?.id).toBe('coin')
  })
})
