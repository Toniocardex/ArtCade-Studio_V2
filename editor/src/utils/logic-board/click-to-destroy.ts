// ---------------------------------------------------------------------------
// "Click to destroy" rule preset — onObjectClick + preventDefault + destroy(self).
// ---------------------------------------------------------------------------

import type { LogicEvent } from '../../types/logic-board'
import type { MouseButtonSide } from './mouse-prevent-default'
import { createLogicEvent } from './factory'

export type ClickToDestroyOptions = {
  button?: MouseButtonSide
  radius?: number
}

export function createClickToDestroyEvent(
  options: ClickToDestroyOptions = {},
): LogicEvent {
  const button = options.button ?? 'right'
  const radius = options.radius ?? 32
  return createLogicEvent(
    { type: 'onObjectClick', button, radius },
    [
      { type: 'preventDefault', button },
      { type: 'destroyEntity', target: 'self' },
    ],
  )
}

/** True when the event matches the canonical Click to destroy recipe. */
export function isClickToDestroyEvent(event: LogicEvent): boolean {
  const t = event.trigger
  if (t.type !== 'onObjectClick') return false

  const { actions } = event
  if (actions.length !== 2) return false

  const [a0, a1] = actions
  if (a0?.type !== 'preventDefault' || a0.button !== t.button) return false
  if (a1?.type !== 'destroyEntity' || a1.target !== 'self') return false
  return true
}

export function clickToDestroySummary(event: LogicEvent): string {
  const btn =
    event.trigger.type === 'onObjectClick' && event.trigger.button === 'right'
      ? 'right mouse'
      : 'left mouse'
  return `Click to destroy (${btn})`
}
