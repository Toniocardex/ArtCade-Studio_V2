// ---------------------------------------------------------------------------
// Editor warnings for Logic Board actions (not runtime API).
// ---------------------------------------------------------------------------

import type { LogicAction, LogicTrigger } from '../../types/logic-board'
import { isCollisionTrigger } from './physics-trigger-capabilities'

const TRIGGERS_WITHOUT_OTHER: ReadonlySet<LogicTrigger['type']> = new Set([
  'onMouseInput',
  'onObjectClick',
  'onInput',
  'onStart',
  'onSpawn',
  'onUpdate',
  'onTimer',
  'onMessage',
  'onDialogMessage',
  'onAnimationEnd',
  'onDestroy',
])

/** Warn when Destroy → Other object cannot work with this trigger. */
export function destroyOtherTargetWarning(
  action: LogicAction,
  trigger: LogicTrigger,
): string | null {
  if (action.type !== 'destroyEntity' || action.target !== 'other') return null
  if (!TRIGGERS_WITHOUT_OTHER.has(trigger.type)) return null
  return (
    '"Other object" is only available on collision or sensor triggers. ' +
    'Use "This object" to destroy the entity running this rule.'
  )
}

/** Warn when Destroy → This object on a collision rule would delete the hero, not the pickup. */
export function destroySelfOnCollisionWarning(
  action: LogicAction,
  trigger: LogicTrigger,
): string | null {
  if (action.type !== 'destroyEntity' || action.target !== 'self') return null
  if (!isCollisionTrigger(trigger.type)) return null
  const cls =
    trigger.type === 'onCollision' ||
    trigger.type === 'onCollisionEnter' ||
    trigger.type === 'onCollisionExit'
      ? trigger.withClass?.trim() ?? ''
      : ''
  if (!cls) return null
  const lower = cls.toLowerCase()
  if (lower === 'coin' || lower === 'pickup') return null
  return (
    'Destroy This removes the entity running this rule (e.g. the player). ' +
    'Use Other object or Destroy objects of class Coin to remove the pickup.'
  )
}
