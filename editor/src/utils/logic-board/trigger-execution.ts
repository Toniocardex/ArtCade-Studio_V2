// ---------------------------------------------------------------------------
// Trigger execution mode — shared by Logic Board UI and the Lua compiler.
// Keeps event-first vs polling classification in one place (Tranche 7).
// ---------------------------------------------------------------------------

import type {
  LogicBoard,
  LogicEvent,
  LogicTrigger,
  LogicTriggerType,
} from '../../types/logic-board'
import type { ProjectDoc } from '../../types'

export type TriggerExecutionMode = 'event' | 'polling' | 'hybrid'

/** Triggers promoted as event-first defaults in the type picker. */
export const RECOMMENDED_TRIGGER_TYPES: readonly LogicTriggerType[] = [
  'onSpawn',
  'onInput',
  'onTriggerEnter',
  'onTriggerExit',
  'onTimer',
  'onStart',
  'onDestroy',
  'onMessage',
  'onAnimationEnd',
] as const

/** Triggers that always (or usually) run inside tick(dt) polling. */
export const POLLING_TRIGGER_TYPES: readonly LogicTriggerType[] = [
  'onUpdate',
  'onCollision',
  'onMouseInput',
] as const

export function boardLifecycleClass(
  board: LogicBoard,
  _ev: LogicEvent,
  project?: ProjectDoc | null,
): string | null {
  if (board.target.type === 'entity_class' && board.target.className)
    return board.target.className
  if (project && board.target.type === 'entity_id') {
    const id = board.target.entityId
    if (id != null) {
      const ent = project.entities[id]
      if (ent?.className) return ent.className
    }
  }
  return null
}

export function canRegisterLifecycleSpawn(
  ev: LogicEvent,
  board: LogicBoard,
  project?: ProjectDoc | null,
): boolean {
  if (ev.trigger.type !== 'onSpawn') return false
  return boardLifecycleClass(board, ev, project) !== null
}

export function canRegisterLifecycleDestroy(
  ev: LogicEvent,
  board: LogicBoard,
  project?: ProjectDoc | null,
): boolean {
  if (ev.trigger.type !== 'onDestroy') return false
  return boardLifecycleClass(board, ev, project) !== null
}

function hasFrameMovement(ev: LogicEvent): boolean {
  return ev.actions.some((action) => action.type === 'controllerMovement')
}

/**
 * True when the compiler emits this event inside tick(dt) instead of (or in
 * addition to) init-time handler registration.
 */
export function usesTickFallback(
  ev: LogicEvent,
  board: LogicBoard,
  project?: ProjectDoc | null,
): boolean {
  const trig = ev.trigger
  if (trig.type === 'onStart' || trig.type === 'onMessage') return false
  if (
    hasFrameMovement(ev) &&
    (
      trig.type === 'onUpdate' ||
      trig.type === 'onInput' ||
      trig.type === 'onMouseInput' ||
      trig.type === 'onCollision' ||
      trig.type === 'onTriggerEnter' ||
      trig.type === 'onTriggerExit' ||
      trig.type === 'onTimer'
    )
  ) return true
  if (trig.type === 'onInput') return trig.eventType === 'down'
  if (trig.type === 'onTimer') {
    // Class-targeted timers need per-instance accumulators so each entity
    // has its own clock. The registration path (time.every) is a single
    // shared timer that fires once for the whole pool — wrong semantics
    // when the user said "every 2s for each enemy". Route through the
    // tick body where the key includes `self`. Single-entity boards
    // (entity_id) still use the cheaper registration path.
    return board.target.type === 'entity_class'
  }
  if (trig.type === 'onTriggerEnter' || trig.type === 'onTriggerExit')
    return false
  if (trig.type === 'onAnimationEnd') return false
  if (trig.type === 'onSpawn') {
    // Never tick-fallback. Falling into the generic per-frame gate path
    // would make the rule fire every frame for the pool — a real
    // every-frame bug surfaced in the review. If we can't register the
    // lifecycle handler (no resolvable className), the event is silently
    // dropped by emitEventRegistration → the rule does nothing rather
    // than misfire. The compatibility matrix already requires an entity
    // target, and call sites in the editor always pass project context,
    // so this drop is theoretical for the current call graph.
    return false
  }
  if (trig.type === 'onDestroy') return !canRegisterLifecycleDestroy(ev, board, project)
  return true
}

export function getTriggerExecutionMode(
  trigger: LogicTrigger,
  board?: LogicBoard,
  event?: LogicEvent,
  project?: ProjectDoc | null,
): TriggerExecutionMode {
  if (board && event && usesTickFallback(event, board, project)) {
    return 'polling'
  }

  if (trigger.type === 'onInput') {
    return trigger.eventType === 'down' ? 'polling' : 'event'
  }
  if (trigger.type === 'onMouseInput') return 'polling'

  if ((POLLING_TRIGGER_TYPES as readonly string[]).includes(trigger.type))
    return 'polling'
  if (trigger.type === 'onSpawn' || trigger.type === 'onDestroy')
    return 'hybrid'
  return 'event'
}

export function triggerPickerGroup(
  type: LogicTriggerType,
): 'Recommended' | 'Advanced / Polling' {
  if ((POLLING_TRIGGER_TYPES as readonly string[]).includes(type))
    return 'Advanced / Polling'
  return 'Recommended'
}

const POLLING_TOOLTIPS: Partial<Record<LogicTriggerType, string>> = {
  onUpdate: 'Runs every frame — uses tick(dt). Prefer events when possible.',
  onCollision:
    'Polls collision.touchingClass each frame. Prefer sensor enter/exit.',
  onMouseInput: 'Polls mouse state each frame inside tick(dt).',
}

export function triggerExecutionTooltip(type: LogicTriggerType): string | undefined {
  return POLLING_TOOLTIPS[type]
}

export function executionModeBadgeLabel(
  mode: TriggerExecutionMode,
  usesPolling: boolean,
): string {
  if (usesPolling || mode === 'polling') return 'Polling'
  if (mode === 'hybrid') return 'Event*'
  return 'Event'
}
