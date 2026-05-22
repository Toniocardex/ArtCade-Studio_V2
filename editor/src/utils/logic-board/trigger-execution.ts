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
] as const

/** Triggers that always (or usually) run inside tick(dt) polling. */
export const POLLING_TRIGGER_TYPES: readonly LogicTriggerType[] = [
  'onUpdate',
  'onCollision',
  'onMouseInput',
  'onAnimationEnd',
] as const

export function boardLifecycleClass(
  board: LogicBoard,
  ev: LogicEvent,
): string | null {
  if (ev.trigger.type === 'onSpawn' && ev.trigger.className)
    return ev.trigger.className
  if (board.target.type === 'entity_class' && board.target.className)
    return board.target.className
  return null
}

export function canRegisterLifecycleSpawn(
  ev: LogicEvent,
  board: LogicBoard,
): boolean {
  if (ev.trigger.type !== 'onSpawn') return false
  return boardLifecycleClass(board, ev) !== null
}

export function canRegisterLifecycleDestroy(
  ev: LogicEvent,
  board: LogicBoard,
): boolean {
  if (ev.trigger.type !== 'onDestroy') return false
  return boardLifecycleClass(board, ev) !== null
}

/**
 * True when the compiler emits this event inside tick(dt) instead of (or in
 * addition to) init-time handler registration.
 */
export function usesTickFallback(ev: LogicEvent, board: LogicBoard): boolean {
  const trig = ev.trigger
  if (trig.type === 'onStart' || trig.type === 'onMessage') return false
  if (trig.type === 'onInput') return trig.eventType === 'down'
  if (trig.type === 'onTimer') return false
  if (trig.type === 'onTriggerEnter' || trig.type === 'onTriggerExit')
    return false
  if (trig.type === 'onSpawn') return !canRegisterLifecycleSpawn(ev, board)
  if (trig.type === 'onDestroy') return !canRegisterLifecycleDestroy(ev, board)
  return true
}

export function getTriggerExecutionMode(
  trigger: LogicTrigger,
  board?: LogicBoard,
  event?: LogicEvent,
): TriggerExecutionMode {
  if (trigger.type === 'onInput') {
    return trigger.eventType === 'down' ? 'polling' : 'event'
  }
  if (trigger.type === 'onMouseInput') return 'polling'

  if (board && event) {
    return usesTickFallback(event, board) ? 'polling' : 'event'
  }

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
  onAnimationEnd:
    'Polls animation.pollFinished each frame. Event hook planned.',
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
