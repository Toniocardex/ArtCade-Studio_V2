// ---------------------------------------------------------------------------
// Trigger ↔ target compatibility matrix.
//
// Each trigger declares which board target types it is valid against. The
// compiler, validator, and UI TypePicker all read from this single source.
//
// Rule of thumb (see the matrix below for the inline rationale per row):
//   • Lifecycle / physics / animation (onSpawn, onDestroy, onCollision,
//     onTriggerEnter/Exit, onAnimationEnd) → ENTITY only. The runtime
//     binds these to a class id; a global board has no class to attach.
//   • Input / messaging (onInput, onMouseInput, onMessage) → ALL targets.
//     On entity boards the actions fan out across the pool ("every enemy
//     reacts to Space"), often the desired intent; on a global board they
//     fire once with self=nil for scene-wide controls. Author picks the
//     semantic via the board target.
//   • System (onStart, onUpdate, onTimer) → ALL targets. Same fan-out
//     reasoning as input/messaging — onTimer specifically gets a per-self
//     accumulator on class boards (see emit-event-body.ts).
//
// Keep this list in sync with editor/src/schemas/logic-board/triggers.json
// and the runtime APIs in runtime-cpp/src/modules/game-api/src/*.cpp.
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent, LogicTriggerType } from '../../types/logic-board'

export type BoardTargetType = LogicBoard['target']['type']

/**
 * Concrete target categories the matrix discriminates. `'scene'` is treated
 * as `'global'` (legacy alias) so we don't list it separately.
 */
const ENTITY_TARGETS: readonly BoardTargetType[] = ['object_type'] as const
const GLOBAL_TARGETS: readonly BoardTargetType[] = ['global', 'scene'] as const
const ALL_TARGETS: readonly BoardTargetType[] = [
  ...ENTITY_TARGETS,
  ...GLOBAL_TARGETS,
] as const

export const TRIGGER_TARGET_MATRIX: Record<
  LogicTriggerType,
  readonly BoardTargetType[]
> = {
  // Lifecycle — entity-only. The runtime binds these to a class id; without
  // one the registration has nothing to attach to.
  onSpawn:            ENTITY_TARGETS,
  onDestroy:          ENTITY_TARGETS,
  // Health — entity-only (requires a HealthComponent, which only entity boards have).
  onHealthDepleted:   ENTITY_TARGETS,
  // Physics — need a specific entity to test collisions/overlaps against.
  onCollision:      ENTITY_TARGETS,
  onCollisionEnter: ENTITY_TARGETS,
  onCollisionExit:  ENTITY_TARGETS,
  onTriggerEnter:   ENTITY_TARGETS,
  onTriggerExit:    ENTITY_TARGETS,
  // Graphics — tied to an entity's sprite animator.
  onAnimationEnd:  ENTITY_TARGETS,
  onObjectClick:   ENTITY_TARGETS,
  onObjectHoverEnter: ENTITY_TARGETS,
  onObjectHoverExit:  ENTITY_TARGETS,
  // Input/messaging — permissive. On entity boards the actions fan out
  // across the pool (often the intent: "every enemy reacts to Space");
  // on a global board they fire once with self=nil for scene-wide controls.
  // The author picks the semantic via the board target.
  onInput:         ALL_TARGETS,
  onMouseInput:    ALL_TARGETS,
  onMessage:       ALL_TARGETS,
  // System — no opinion on entity context.
  onStart:         ALL_TARGETS,
  onUpdate:        ALL_TARGETS,
  onTimer:         ALL_TARGETS,
}

export function isTriggerCompatible(
  trigger: LogicTriggerType,
  target: BoardTargetType,
): boolean {
  return TRIGGER_TARGET_MATRIX[trigger].includes(target)
}

/** Trigger types valid for a given board target — used by the UI picker. */
export function allowedTriggersForTarget(
  target: BoardTargetType,
): LogicTriggerType[] {
  const out: LogicTriggerType[] = []
  for (const t of Object.keys(TRIGGER_TARGET_MATRIX) as LogicTriggerType[]) {
    if (isTriggerCompatible(t, target)) out.push(t)
  }
  return out
}

export interface BoardCompatibilityError {
  /** Stable id for the offending event so the UI can highlight the right card. */
  eventId: string
  trigger: LogicTriggerType
  target: BoardTargetType
  message: string
}

/**
 * Returns the list of incompatibility errors for a board, one per offending
 * event. Empty list means the board passes compatibility.
 */
export function findBoardCompatibilityErrors(
  board: LogicBoard,
): BoardCompatibilityError[] {
  const target = board.target.type
  const errors: BoardCompatibilityError[] = []
  for (const ev of board.events) {
    if (!isTriggerCompatible(ev.trigger.type, target)) {
      const allowed = TRIGGER_TARGET_MATRIX[ev.trigger.type].join(' or ')
      errors.push({
        eventId: ev.id,
        trigger: ev.trigger.type,
        target,
        message:
          `${ev.trigger.type} is not allowed on a ${target} board — ` +
          `valid targets: ${allowed}.`,
      })
    }
  }
  return errors
}

/**
 * Compiler-side assertion. Called from compileLogicBoard before emitting Lua
 * so a misconfigured board fails loudly instead of silently producing broken
 * code (e.g. onInput fanned out across an entity pool).
 */
export function assertBoardCompatible(board: LogicBoard): void {
  const errors = findBoardCompatibilityErrors(board)
  if (errors.length === 0) return
  const detail = errors
    .map((e) => `  • event "${e.eventId}": ${e.message}`)
    .join('\n')
  throw new Error(
    `Logic Board "${board.boardId}" has incompatible triggers:\n${detail}`,
  )
}

/** Convenience for UI surfaces that hold a single event. */
export function eventCompatibilityError(
  ev: LogicEvent,
  target: BoardTargetType,
): string | null {
  if (isTriggerCompatible(ev.trigger.type, target)) return null
  const allowed = TRIGGER_TARGET_MATRIX[ev.trigger.type].join(' or ')
  return (
    `${ev.trigger.type} requires a ${allowed} board — ` +
    `current board target is "${target}".`
  )
}
