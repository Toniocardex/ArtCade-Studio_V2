import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../project'
import { createEntityDef } from '../project-builders'
import type { LogicBoard } from '../../types/logic-board'
import {
  collisionTriggerRequirement,
  entityHasCollisionBody,
  entityHasOverlapBounds,
} from './physics-trigger-capabilities'

function entityBoard(_entityId: number): LogicBoard {
  return {
    boardId: 'b1',
    target: { type: 'object_type', objectTypeId: 'Player' },
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
      },
    }
    expect(entityHasCollisionBody(e)).toBe(true)
  })

  it('entityHasOverlapBounds is true for any entity def', () => {
    expect(entityHasOverlapBounds(createEntityDef(1))).toBe(true)
  })

  it('platformer-only gets optional hitbox hint, not missing Physics', () => {
    const project = createBlankProject('T')
    const player = createEntityDef(1, 'Player', 'Player')
    player.platformerController = {
      maxSpeed: 300, jumpForce: 600, customGravity: 1500,
      coyoteTime: 0.15, jumpBuffer: 0.1,
    }
    project.entities[1] = player

    const req = collisionTriggerRequirement(
      { type: 'onCollisionEnter', filter: { className: 'Coin' } },
      project,
      entityBoard(1),
    )
    expect(req?.status).toBe('partial')
    expect(req?.message).toMatch(/default 32/)
    expect(req?.message).not.toMatch(/require physics overlap/i)
  })

  it('clears warning when physics collider present for tuning', () => {
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
      },
    }
    project.entities[1] = player

    expect(
      collisionTriggerRequirement(
        { type: 'onCollision', filter: { className: 'Coin' } },
        project,
        entityBoard(1),
      ),
    ).toBeNull()
  })

  it('does not warn about physicsMode off for collision overlap', () => {
    const project = createBlankProject('T')
    project.world = { gravity: 9.81, pixelsPerMeter: 100, timeScale: 1, physicsMode: 'off' }
    const player = createEntityDef(1, 'Player', 'Player')
    player.platformerController = {
      maxSpeed: 300, jumpForce: 600, customGravity: 1500,
      coyoteTime: 0.15, jumpBuffer: 0.1,
    }
    project.entities[1] = player

    const req = collisionTriggerRequirement(
      { type: 'onCollisionEnter', filter: { className: 'Coin' } },
      project,
      entityBoard(1),
    )
    expect(req?.message).not.toMatch(/physics is Off/i)
  })
})
