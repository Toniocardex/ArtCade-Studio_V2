import type { EntityDef, ProjectDoc } from '../../types'
import type { LogicBoard, LogicTrigger } from '../../types/logic-board'
import type { CapabilityRequirement } from './component-capabilities'

const COLLISION_TRIGGERS = new Set<LogicTrigger['type']>([
  'onCollision',
  'onCollisionEnter',
  'onCollisionExit',
])

export function isCollisionTrigger(type: LogicTrigger['type']): boolean {
  return COLLISION_TRIGGERS.has(type)
}

/** True when the entity can participate in Box2D overlap / collision events. */
export function entityHasCollisionBody(entity: EntityDef): boolean {
  const p = entity.physics
  if (!p) return false
  return p.collider.size.x > 2 || p.collider.size.y > 2
}

function targetEntityIds(project: ProjectDoc, board: LogicBoard): number[] {
  if (board.target.type === 'entity_id' && board.target.entityId != null) {
    return project.entities[board.target.entityId] ? [board.target.entityId] : []
  }
  if (board.target.type === 'entity_class' && board.target.className) {
    return Object.values(project.entities)
      .filter((e) => e.className === board.target.className)
      .map((e) => e.id)
  }
  return []
}

/**
 * Logic Board warning when collision triggers are used without a Box2D collider
 * on the board's target entity/entities.
 */
export function collisionTriggerRequirement(
  trigger: LogicTrigger,
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
): CapabilityRequirement | null {
  if (!isCollisionTrigger(trigger.type) || !project || !board) return null

  const ids = targetEntityIds(project, board)
  if (ids.length === 0) {
    return {
      label: 'Physics (Box2D Body)',
      status: 'missing',
      message:
        'Collision triggers need a target entity with a Physics collider. ' +
        'For arcade games without Box2D, use Sensor zones (onTriggerEnter/Exit) or messages instead.',
    }
  }

  const withBody = ids.filter((id) => entityHasCollisionBody(project.entities[id]))
  if (withBody.length === ids.length) {
    if (project.world?.physicsMode === 'off') {
      return {
        label: 'World physics',
        status: 'partial',
        message:
          'World physics is Off — collision events will not run. Set World → Physics simulation to Auto or On, or use Sensor triggers.',
      }
    }
    return null
  }

  if (withBody.length > 0) {
    return {
      label: 'Physics (Box2D Body)',
      status: 'partial',
      message:
        'Some targets lack a Physics collider — collision rules only run on entities with Box2D overlap. ' +
        'Platformer movement alone does not create a body; add Physics in the Inspector if you need onCollision.',
    }
  }

  return {
    label: 'Physics (Box2D Body)',
    status: 'missing',
    message:
      'While touching / collision triggers require Box2D overlap. Add Physics (Box2D Body) on this entity, ' +
      'or use onTriggerEnter/Exit with a Sensor zone, or onMessage for arcade logic without physics.',
  }
}
