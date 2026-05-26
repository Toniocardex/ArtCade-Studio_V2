import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../project'
import { createEntityDef } from '../project-builders'
import type { LogicBoard } from '../../types/logic-board'
import {
  collisionTriggerRequirement,
  entityHasCollisionBody,
} from './physics-trigger-capabilities'

function entityBoard(entityId: number): LogicBoard {
  return {
    boardId: 'b1',
    target: { type: 'entity_id', entityId },
    events: [],
  }
}

describe('physics-trigger-capabilities', () => {
  it('entityHasCollisionBody requires explicit collider size', () => {
    const e = createEntityDef(1)
    expect(entityHasCollisionBody(e)).toBe(false)
    e.physics = {
      bodyType: 'Dynamic',
      collider: {
        shape: 'Rectangle',
        size: { x: 32, y: 32 },
        offset: { x: 0, y: 0 },
        density: 1,
        friction: 0.3,
        isSensor: false,
      },
    }
    expect(entityHasCollisionBody(e)).toBe(true)
  })

  it('warns when onCollision used on platformer-only entity', () => {
    const project = createBlankProject('T')
    const player = createEntityDef(1, 'Player', 'Player')
    player.platformerController = {
      maxSpeed: 300, jumpForce: 600, customGravity: 1500,
      coyoteTime: 0.15, jumpBuffer: 0.1, groundClass: 'Ground',
    }
    project.entities[1] = player

    const req = collisionTriggerRequirement(
      { type: 'onCollisionEnter', withClass: 'Coin' },
      project,
      entityBoard(1),
    )
    expect(req?.status).toBe('missing')
    expect(req?.message).toMatch(/Physics/)
  })

  it('clears warning when physics collider present', () => {
    const project = createBlankProject('T')
    const player = createEntityDef(1, 'Player', 'Player')
    player.physics = {
      bodyType: 'Kinematic',
      collider: {
        shape: 'Rectangle',
        size: { x: 32, y: 32 },
        offset: { x: 0, y: 0 },
        density: 1,
        friction: 0.3,
        isSensor: false,
      },
    }
    project.entities[1] = player

    expect(
      collisionTriggerRequirement(
        { type: 'onCollision', withClass: 'Coin' },
        project,
        entityBoard(1),
      ),
    ).toBeNull()
  })

  it('warns when world physicsMode is off despite collider', () => {
    const project = createBlankProject('T')
    project.world = { gravity: 9.81, pixelsPerMeter: 100, timeScale: 1, physicsMode: 'off' }
    const player = createEntityDef(1, 'Player', 'Player')
    player.physics = {
      bodyType: 'Dynamic',
      collider: {
        shape: 'Rectangle',
        size: { x: 32, y: 32 },
        offset: { x: 0, y: 0 },
        density: 1,
        friction: 0.3,
        isSensor: false,
      },
    }
    project.entities[1] = player

    const req = collisionTriggerRequirement(
      { type: 'onCollisionEnter', withClass: 'Coin' },
      project,
      entityBoard(1),
    )
    expect(req?.status).toBe('partial')
    expect(req?.message).toMatch(/Off/)
  })
})
