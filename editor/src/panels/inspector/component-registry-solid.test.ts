import { describe, it, expect } from 'vitest'
import { descriptorFor } from './component-registry'

describe('Collision Body component registry', () => {
  it('exposes body type options', () => {
    const collision = descriptorFor('collisionBody')
    expect(collision).toBeDefined()
    if (!collision) return

    const bodyType = collision.fields.find((f) => f.key === 'bodyType')
    expect(bodyType?.options).toEqual(['static', 'kinematic', 'dynamic'])
  })

  it('create() defaults to a solid ground shape', () => {
    const collision = descriptorFor('collisionBody')
    expect(collision).toBeDefined()
    if (!collision) return

    const inst = collision.create()
    expect(inst).toMatchObject({
      bodyType: 'static',
      shapes: [{ layerId: 'ground', maskLayerIds: ['player', 'enemy', 'projectile'] }],
    })
  })
})
