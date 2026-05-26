import { describe, expect, it } from 'vitest'
import { createBlankProject, parseProjectDoc, serializeProjectDoc } from './project'
import type { EntityDef, ProjectDoc } from '../types'

describe('entity physics component', () => {
  it('round-trips explicit physics collider', () => {
    const entity: EntityDef = {
      id: 1,
      name: 'Crate',
      className: 'Crate',
      tags: [],
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite: {
        spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 },
        alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0,
      },
      physics: {
        bodyType: 'Kinematic',
        collider: {
          shape: 'Rectangle',
          size: { x: 48, y: 24 },
          offset: { x: 0, y: 4 },
          density: 1,
          friction: 0.5,
          isSensor: false,
        },
      },
    }

    const doc: ProjectDoc = { ...createBlankProject('T'), entities: { 1: entity } }
    const roundTrip = parseProjectDoc(serializeProjectDoc(doc))
    expect(roundTrip!.entities[1].physics).toEqual(entity.physics)
  })

  it('omits physics when not authored', () => {
    const doc: ProjectDoc = {
      ...createBlankProject('T'),
      entities: {
        1: {
          id: 1,
          name: 'Player',
          className: 'Player',
          tags: [],
          transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
          sprite: {
            spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 },
            alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0,
          },
          platformerController: {
            maxSpeed: 300, jumpForce: 600, customGravity: 1500,
            coyoteTime: 0.15, jumpBuffer: 0.1, groundClass: 'Ground',
          },
        },
      },
    }
    const json = serializeProjectDoc(doc)
    const parsed = JSON.parse(json) as { entities: Record<string, unknown> }
    expect(parsed.entities['1']).not.toHaveProperty('physics')
    const roundTrip = parseProjectDoc(json)
    expect(roundTrip!.entities[1].physics).toBeUndefined()
  })
})
