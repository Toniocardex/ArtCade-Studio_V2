// ---------------------------------------------------------------------------
// "Click to destroy" rule preset — onObjectClick + destroy(self).
// Browser default suppression for right-click is editor/runtime only (PreviewPanel).
// ---------------------------------------------------------------------------

import type { LogicEvent } from '../../types/logic-board'
import { createLogicEvent } from './factory'

export type ClickToDestroyButton = 'left' | 'right'

export type ClickToDestroyOptions = {
  button?: ClickToDestroyButton
  radius?: number
}

export function createClickToDestroyEvent(
  options: ClickToDestroyOptions = {},
): LogicEvent {
  const button = options.button ?? 'right'
  const radius = options.radius ?? 32
  return createLogicEvent(
    { type: 'onObjectClick', button, radius },
    [{ type: 'destroyEntity', target: 'self' }],
  )
}

/** True when the event matches the canonical Click to destroy recipe. */
export function isClickToDestroyEvent(event: LogicEvent): boolean {
  const t = event.trigger
  if (t.type !== 'onObjectClick') return false
  const { actions } = event
  return (
    actions.length === 1 &&
    actions[0]?.type === 'destroyEntity' &&
    actions[0].target === 'self'
  )
}

export function clickToDestroySummary(event: LogicEvent): string {
  const btn =
    event.trigger.type === 'onObjectClick' && event.trigger.button === 'right'
      ? 'right mouse'
      : 'left mouse'
  return `Click to destroy (${btn})`
}
