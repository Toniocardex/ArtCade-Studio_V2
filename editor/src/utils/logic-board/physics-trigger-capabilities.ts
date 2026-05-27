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

/** Explicit Physics collider size in the inspector (tuning hitbox). */
export function entityHasCollisionBody(entity: EntityDef): boolean {
  const p = entity.physics
  if (!p) return false
  return p.collider.size.x > 2 || p.collider.size.y > 2
}

/** Target can use geometric overlap (Transform + default or explicit collider). */
export function entityHasOverlapBounds(entity: EntityDef): boolean {
  return entity != null
}

function targetEntityIds(project: ProjectDoc, board: LogicBoard): number[] {
  if (board.target.type === 'entity_id' && board.target.entityId != null) {
    return project.entities[board.target.entityId] ? [board.target.entityId] : []
  }
  if (board.target.type === 'object_type' && board.target.objectTypeId) {
    return Object.values(project.entities)
      .filter((e) => e.className === board.target.objectTypeId)
      .map((e) => e.id)
  }
  if (board.target.type === 'entity_class' && board.target.className) {
    return Object.values(project.entities)
      .filter((e) => e.className === board.target.className)
      .map((e) => e.id)
  }
  return []
}

/**
 * Logic Board hints for collision triggers — geometric overlap does not require
 * a Physics body; optional collider tunes the default 32×scale hitbox.
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
      label: 'Collision target',
      status: 'missing',
      message:
        'Collision triggers need a target entity on this rulesheet. ' +
        'Use Sensor zones (onTriggerEnter/Exit) or messages for global logic.',
    }
  }

  const withBounds = ids.filter((id) =>
    entityHasOverlapBounds(project.entities[id]),
  )
  if (withBounds.length !== ids.length) return null

  const tuned = ids.filter((id) => entityHasCollisionBody(project.entities[id]))
  if (tuned.length === 0) {
    return {
      label: 'Hitbox (optional)',
      status: 'partial',
      message:
        'Overlap uses Transform bounds (default 32×scale). Add Physics (Collider) in the Inspector to tune the hitbox — not required for pickup.',
    }
  }

  if (tuned.length < ids.length) {
    return {
      label: 'Hitbox (optional)',
      status: 'partial',
      message:
        'Some targets use the default hitbox only. Add Physics (Collider) to tune size per entity.',
    }
  }

  return null
}
