import type { EntityDef, ProjectDoc } from '../../types'
import type { LogicBoard, LogicTrigger } from '../../types/logic-board'
import { logicBoardTargetEntityIds } from '../project-queries'
import type { CapabilityRequirement } from './component-capabilities'

const COLLISION_TRIGGERS = new Set<LogicTrigger['type']>([
  'onCollision',
  'onCollisionEnter',
  'onCollisionExit',
])

export function isCollisionTrigger(type: LogicTrigger['type']): boolean {
  return COLLISION_TRIGGERS.has(type)
}

/** Explicit Collision Body profile/shapes in the inspector (tuning hitbox). */
export function entityHasCollisionBody(entity: EntityDef): boolean {
  const body = entity.collisionBody
  if (!body?.enabled) return false
  return Boolean(body.profileId?.trim()) || body.shapes.some(shape => shape.enabled)
}

/** Target can use geometric overlap via CollisionWorld/default authored bounds. */
export function entityHasOverlapBounds(entity: EntityDef): boolean {
  return entity != null
}

function targetEntityIds(project: ProjectDoc, board: LogicBoard): number[] {
  return logicBoardTargetEntityIds(project, board)
}

/**
 * Logic Board hints for collision triggers. CollisionWorld does not require a
 * Physics body; Collision Body profiles/shapes tune the default authored bounds.
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
        'Use Trigger Areas (onTriggerEnter/Exit) or messages for global logic.',
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
        'Overlap uses authored default bounds. Add Collision Body in the Inspector to tune the hitbox - not required for pickup.',
    }
  }

  if (tuned.length < ids.length) {
    return {
      label: 'Hitbox (optional)',
      status: 'partial',
      message:
        'Some targets use default bounds only. Add Collision Body to tune size per entity.',
    }
  }

  return null
}
