import { describe, expect, it } from 'vitest'
import type { ProjectDoc } from '../../types'
import { resolveEffectiveEntitySelection } from './logic-board-selection'

function projectWithEntityInSceneS(entityId: number, sceneId: string): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      [entityId]: {
        id: entityId,
        name: 'Box',
        className: 'Box',
        tags: [],
        transform: {
          position: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotation: 0,
        },
        visible: true,
      },
    },
    scenes: {
      s: {
        id: 's',
        name: 'S',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: sceneId === 's' ? [entityId] : [],
      },
      s2: {
        id: 's2',
        name: 'S2',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: sceneId === 's2' ? [entityId] : [],
      },
    },
  }
}

describe('resolveEffectiveEntitySelection', () => {
  it('returns null when entityId is null', () => {
    const project = projectWithEntityInSceneS(1, 's')
    expect(resolveEffectiveEntitySelection(project, 's', null)).toEqual({
      effectiveEntityId: null,
      inScene: false,
    })
  })

  it('keeps entity when it belongs to the scene', () => {
    const project = projectWithEntityInSceneS(1, 's')
    expect(resolveEffectiveEntitySelection(project, 's', 1)).toEqual({
      effectiveEntityId: 1,
      inScene: true,
    })
  })

  it('clears effective selection when entity is only in another scene', () => {
    const project = projectWithEntityInSceneS(1, 's2')
    expect(resolveEffectiveEntitySelection(project, 's', 1)).toEqual({
      effectiveEntityId: null,
      inScene: false,
    })
  })
})
