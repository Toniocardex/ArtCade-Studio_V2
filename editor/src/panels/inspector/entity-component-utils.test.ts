import { describe, it, expect } from 'vitest'
import type { EntityDef } from '../../types'
import { activeComponentDescriptors, componentBlockId } from './entity-component-utils'

function baseEntity(): EntityDef {
  return {
    id: 1,
    name: 'E',
    className: 'Entity',
    tags: [],
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
    },
    sprite: {
      spriteAssetId: '',
      tint: { x: 1, y: 1, z: 1, w: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
    },
    visible: true,
  }
}

describe('entity-component-utils', () => {
  it('lists only attached components', () => {
    const entity = {
      ...baseEntity(),
      health: { maxHp: 10, currentHp: 10, iFrames: 0.2 },
      sensor: {
        shape: 'Circle' as const,
        radius: 64,
        width: 64,
        height: 64,
        targetTag: 'player',
      },
    }
    const keys = activeComponentDescriptors(entity).map((d) => d.key)
    expect(keys).toEqual(['sensor', 'health'])
  })

  it('componentBlockId is stable for scroll targets', () => {
    expect(componentBlockId('platformerController')).toBe('inspector-component-platformerController')
  })
})
