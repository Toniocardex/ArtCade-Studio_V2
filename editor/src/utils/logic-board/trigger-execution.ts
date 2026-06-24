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
import { logicBoardRuntimeClassKey, logicBoardTargetTypeKey } from '../project-queries'
import { onInputUsesPolling } from './on-input-keys'

export type TriggerExecutionMode = 'event' | 'polling' | 'hybrid'

/** Triggers promoted as event-first defaults in the type picker. */
export const RECOMMENDED_TRIGGER_TYPES: readonly LogicTriggerType[] = [
  'onSpawn',
  'onInput',
  'onTriggerEnter',
  'onTriggerExit',
  'onTimer',
  'onObjectClick',
  'onObjectHoverEnter',
  'onObjectHoverExit',
  'onStart',
  'onDestroy',
  'onMessage',
  'onDialogMessage',
  'onAnimationEnd',
  'onAnimationStart',
  'onAnimationFrame',
  'onAnimationLoop',
  'onAnimationChange',
] as const

/** Triggers that always (or usually) run inside tick(dt) polling. */
export const POLLING_TRIGGER_TYPES: readonly LogicTriggerType[] = [
  'onUpdate',
  'onCollision',
  'onHealthDepleted',
  'onDamaged',
  'onLeaveScreen',
  'onMouseInput',
  'onObjectClick',
  'onObjectHoverEnter',
  'onObjectHoverExit',
] as const

export function boardLifecycleClass(
  board: LogicBoard,
  _ev: LogicEvent,
  project?: ProjectDoc | null,
): string | null {
  if (project) {
    return logicBoardRuntimeClassKey(project, board) ?? null
  }
  return logicBoardTargetTypeKey(board.target) ?? null
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
  if (trig.type === 'onStart' || trig.type === 'onMessage' || trig.type === 'onDialogMessage') return false
  if (
    hasFrameMovement(ev) &&
    (
      trig.type === 'onUpdate' ||
      trig.type === 'onInput' ||
      trig.type === 'onMouseInput' ||
      trig.type === 'onObjectClick' ||
      trig.type === 'onObjectHoverEnter' ||
      trig.type === 'onObjectHoverExit' ||
      trig.type === 'onCollision' ||
      trig.type === 'onTriggerEnter' ||
      trig.type === 'onTriggerExit' ||
      trig.type === 'onTimer'
    )
  ) return true
  if (trig.type === 'onInput') {
    if (onInputUsesPolling(trig)) return true
    return trig.eventType === 'down'
  }
  if (trig.type === 'onTimer') {
    // Type-targeted timers need per-instance accumulators so each entity
    // has its own clock. The registration path (time.every) is a single
    // shared timer that fires once for the whole pool — wrong semantics
    // when the user said "every 2s for each enemy". Route through the
    // tick body where the key includes `self`.
    return board.target.type === 'object_type'
  }
  if (trig.type === 'onTriggerEnter' || trig.type === 'onTriggerExit')
    return false
  if (
    trig.type === 'onAnimationEnd' ||
    trig.type === 'onAnimationStart' ||
    trig.type === 'onAnimationFrame' ||
    trig.type === 'onAnimationLoop' ||
    trig.type === 'onAnimationChange'
  ) return false
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
    return onInputUsesPolling(trigger) ? 'polling' : 'event'
  }
  if (trigger.type === 'onMouseInput') return 'polling'
  if (trigger.type === 'onObjectClick') return 'polling'
  if (trigger.type === 'onObjectHoverEnter') return 'polling'
  if (trigger.type === 'onObjectHoverExit') return 'polling'

  if ((POLLING_TRIGGER_TYPES as readonly string[]).includes(trigger.type))
    return 'polling'
  if (trigger.type === 'onSpawn' || trigger.type === 'onDestroy')
    return 'hybrid'
  return 'event'
}

export function triggerPickerGroup(type: LogicTriggerType): string {
  switch (type) {
    case 'onStart':
    case 'onTimer':
      return 'Time'
    case 'onSpawn':
    case 'onDestroy':
    case 'onHealthDepleted':
    case 'onDamaged':
    case 'onLeaveScreen':
      return 'Object state'
    case 'onCollisionEnter':
    case 'onCollisionExit':
    case 'onCollision':
      return 'Contact'
    case 'onTriggerEnter':
    case 'onTriggerExit':
      return 'Zones'
    case 'onInput':
    case 'onMouseInput':
    case 'onObjectClick':
    case 'onObjectHoverEnter':
    case 'onObjectHoverExit':
      return 'Input'
    case 'onAnimationEnd':
    case 'onAnimationStart':
    case 'onAnimationFrame':
    case 'onAnimationLoop':
    case 'onAnimationChange':
      return 'Animation'
    case 'onMessage':
      return 'Event Bus'
    case 'onDialogMessage':
      return 'Dialog'
    case 'onUpdate':
      return 'Every frame'
  }
}

const POLLING_TOOLTIPS: Partial<Record<LogicTriggerType, string>> = {
  onUpdate: 'Runs every frame - use for continuous checks or per-frame motion.',
  onCollision:
    'Runs every frame while objects touch. Use Starts/Stops touching for one-shot contact actions.',
  onMouseInput: 'Checks mouse button state. Add a Mouse nearby check when the action should require the cursor over this object.',
  onObjectClick: 'Runs when the mouse button is pressed while the cursor is near this object.',
  onObjectHoverEnter: 'Runs once when the pointer moves into this object.',
  onObjectHoverExit: 'Runs once when the pointer moves out of this object.',
}

export function triggerExecutionTooltip(type: LogicTriggerType): string | undefined {
  return POLLING_TOOLTIPS[type]
}

export function executionModeBadgeLabel(
  mode: TriggerExecutionMode,
  usesPolling: boolean,
): string {
  if (usesPolling || mode === 'polling') return 'Every frame'
  if (mode === 'hybrid') return 'Triggered*'
  return 'Triggered'
}
