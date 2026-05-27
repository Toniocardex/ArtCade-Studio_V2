// ---------------------------------------------------------------------------
// Editor warnings for Logic Board actions (not runtime API).
// ---------------------------------------------------------------------------

import type { LogicAction, LogicTrigger } from '../../types/logic-board'

const TRIGGERS_WITHOUT_OTHER: ReadonlySet<LogicTrigger['type']> = new Set([
  'onMouseInput',
  'onObjectClick',
  'onInput',
  'onStart',
  'onSpawn',
  'onUpdate',
  'onTimer',
  'onMessage',
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
