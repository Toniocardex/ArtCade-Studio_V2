import { describe, expect, it } from 'vitest'
import type { ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import {
  actionRequirement,
  conditionRequirement,
  recommendedActionTypes,
  triggerRequirement,
} from './component-capabilities'

function entity(id: number, className: string, extra = {}) {
  return {
    id,
    name: `${className}_${id}`,
    className,
    tags: [],
    transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
    sprite: {
      spriteAssetId: '',
      tint: { x: 1, y: 1, z: 1, w: 1 },
      alpha: 1,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
    },
    ...extra,
  }
}

function project(): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: entity(1, 'Player', {
        topDownController: { maxSpeed: 260, acceleration: 1000, friction: 1000, fourDirections: false },
        health: { maxHp: 100, currentHp: 100, iFrames: 0.2 },
      }),
      2: entity(2, 'Enemy'),
      3: entity(3, 'Zone', {
        sensor: { shape: 'Circle', radius: 100, width: 64, height: 64, targetTag: 'player' },
      }),
    },
    scenes: {
      s: {
        id: 's',
        name: 'S',
        worldSize: { x: 1280, y: 720 },
        viewportSize: { x: 1280, y: 720 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [1, 2, 3],
      },
    },
  }
}

describe('component capabilities', () => {
  it('recommends actions from components on an entity board', () => {
    const board: LogicBoard = { boardId: 'b', target: { type: 'entity_id', entityId: 1 }, events: [] }
    expect(recommendedActionTypes(project(), board)).toEqual([
      'moveController',
      'setMovementIntent',
      'clearMovementIntent',
      'damageEntity',
      'healEntity',
      'setEntityHealth',
    ])
  })

  it('warns when a required component is missing', () => {
    const board: LogicBoard = { boardId: 'b', target: { type: 'entity_id', entityId: 2 }, events: [] }
    const req = actionRequirement(
      { type: 'damageEntity', target: 'self', amount: 5 },
      project(),
      board,
    )
    expect(req?.component).toBe('health')
    expect(req?.status).toBe('missing')
  })

  it('detects partial class-board component coverage', () => {
    const p = project()
    p.entities[4] = entity(4, 'Player')
    const board: LogicBoard = { boardId: 'b', target: { type: 'entity_class', className: 'Player' }, events: [] }
    const req = conditionRequirement(
      { type: 'compareHealth', target: 'self', field: 'current', operator: '>', value: 0 },
      p,
      board,
    )
    expect(req?.status).toBe('partial')
  })

  it('maps sensor triggers to SensorComponent requirements', () => {
    const board: LogicBoard = { boardId: 'b', target: { type: 'entity_id', entityId: 3 }, events: [] }
    expect(triggerRequirement({ type: 'onTriggerEnter', withClass: 'player' }, project(), board)).toBeNull()
  })

  it('recommends Tranche 2 actions from component fields', () => {
    const p = project()
    p.entities[5] = entity(5, 'Bullet', {
      linearMover: { directionX: 1, directionY: 0, speed: 200 },
      magneticItem: { attractTag: 'coin', radius: 100, pullSpeed: 50 },
      hordeMember: { targetClass: 'Player', chaseWeight: 1, separationWeight: 0.5 },
      autoDestroy: { lifespan: 2 },
      platformerController: {
        maxSpeed: 200, jumpForce: 400, gravity: 900, groundClass: 'Ground',
      },
    })
    const board: LogicBoard = { boardId: 'b', target: { type: 'entity_id', entityId: 5 }, events: [] }
    expect(recommendedActionTypes(p, board)).toEqual([
      'moveController',
      'setMovementIntent',
      'clearMovementIntent',
      'requestPlatformerJump',
      'setLinearMoverDirection',
      'setLinearMoverSpeed',
      'pauseLinearMover',
      'resumeLinearMover',
      'setMagnetEnabled',
      'setMagnetTargetTag',
      'setHordeTargetClass',
      'setHordeWeights',
      'setAutoDestroyLifespan',
      'cancelAutoDestroy',
    ])
    expect(
      conditionRequirement(
        { type: 'isPlatformerGrounded', target: 'self' },
        p,
        board,
      ),
    ).toBeNull()
  })
})
