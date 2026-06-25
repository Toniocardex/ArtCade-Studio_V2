import { describe, expect, it } from 'vitest'
import { createBlankProject, parseProjectDoc, serializeProjectDoc } from './project'
import { migrateLegacyProject } from './project-object-types'
import type { EntityDef, ProjectDoc } from '../types'

function docWithEntity(entity: EntityDef, projectName = 'T'): ProjectDoc {
  const base = createBlankProject(projectName)
  return migrateLegacyProject({
    ...base,
    entities: { [entity.id]: entity },
    scenes: {
      scene_main: {
        ...base.scenes.scene_main,
        entityIds: [entity.id],
      },
    },
  })
}

describe('entity physics component', () => {
  it('round-trips explicit physics collider', () => {
    const entity: EntityDef = {
      id: 1,
      name: 'Crate',
      className: 'Crate',
      tags: [],
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite: {
        spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 },
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
        },
      },
    }

    const doc = docWithEntity(entity)
    const roundTrip = parseProjectDoc(serializeProjectDoc(doc))
    expect(roundTrip!.entities[1].physics).toEqual(entity.physics)
  })

  it('omits physics when not authored', () => {
    const doc = docWithEntity({
      id: 1,
      name: 'Player',
      className: 'Player',
      tags: [],
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
      sprite: {
        spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 },
        alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0,
      },
      platformerController: {
        maxSpeed: 300, jumpForce: 600, customGravity: 1500,
        coyoteTime: 0.15, jumpBuffer: 0.1,
      },
    })
    const json = serializeProjectDoc(doc)
    const parsed = JSON.parse(json) as { objectTypes: Record<string, Record<string, unknown>> }
    expect(parsed.objectTypes.Player).not.toHaveProperty('physics')
    const roundTrip = parseProjectDoc(json)
    expect(roundTrip!.entities[1].physics).toBeUndefined()
  })
})
