// ---------------------------------------------------------------------------
// "Click to destroy" — Logic Board action + trigger sync helpers.
// Browser default suppression for right-click is editor-only (PreviewPanel).
// ---------------------------------------------------------------------------

import type { LogicAction, LogicEvent } from '../../types/logic-board'
import { createLogicEvent } from './factory'

export type ClickToDestroyButton = 'left' | 'right'

export type ClickToDestroyOptions = {
  button?: ClickToDestroyButton
  radius?: number
}

export function defaultClickToDestroyAction(
  options: ClickToDestroyOptions = {},
): LogicAction {
  const button = options.button ?? 'right'
  const radius = options.radius ?? 32
  return { type: 'clickToDestroy', button, radius }
}

/** When a rule includes Click to destroy, force Object clicked trigger params. */
export function applyClickToDestroyTrigger(event: LogicEvent): LogicEvent {
  const ctd = event.actions.find((a): a is Extract<LogicAction, { type: 'clickToDestroy' }> =>
    a.type === 'clickToDestroy',
  )
  if (!ctd) return event
  const button = ctd.button ?? 'right'
  const radius = ctd.radius ?? 32
  return {
    ...event,
    trigger: { type: 'onObjectClick', button, radius },
  }
}

export function createClickToDestroyEvent(
  options: ClickToDestroyOptions = {},
): LogicEvent {
  return applyClickToDestroyTrigger(
    createLogicEvent(
      { type: 'onObjectClick', button: options.button ?? 'right', radius: options.radius ?? 32 },
      [defaultClickToDestroyAction(options)],
    ),
  )
}

/** True when the rule is only Click to destroy (or legacy destroy-on-click recipe). */
export function isClickToDestroyEvent(event: LogicEvent): boolean {
  if (
    event.actions.length === 1 &&
    event.actions[0]?.type === 'clickToDestroy'
  ) {
    return true
  }
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
  const ctd = event.actions.find(
    (a): a is Extract<LogicAction, { type: 'clickToDestroy' }> => a.type === 'clickToDestroy',
  )
  const btn =
    (ctd?.button === 'right') ||
    (!ctd &&
      event.trigger.type === 'onObjectClick' &&
      event.trigger.button === 'right')
      ? 'right mouse'
      : 'left mouse'
  return `Click to destroy (${btn})`
}
