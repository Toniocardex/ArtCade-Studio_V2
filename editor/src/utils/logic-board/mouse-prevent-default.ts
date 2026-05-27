// ---------------------------------------------------------------------------
// Mouse-button rules: ensure a preventDefault() action blocks browser defaults
// (context menu on right click, text selection on left click in WebView).
// ---------------------------------------------------------------------------

import type { LogicAction, LogicEvent, LogicTrigger } from '../../types/logic-board'

export type MouseButtonSide = 'left' | 'right'

export function mouseButtonFromTrigger(
  trigger: LogicTrigger,
): MouseButtonSide | null {
  if (trigger.type === 'onMouseInput' || trigger.type === 'onObjectClick') {
    return trigger.button
  }
  return null
}

export function defaultPreventDefaultAction(
  button: MouseButtonSide,
): LogicAction {
  return { type: 'preventDefault', button }
}

function hasPreventDefaultForButton(
  actions: readonly LogicAction[],
  button: MouseButtonSide,
): boolean {
  return actions.some(
    (a) => a.type === 'preventDefault' && a.button === button,
  )
}

/** Prepend preventDefault for the trigger's mouse button when missing. */
export function applyMousePreventDefaultDefaults(event: LogicEvent): LogicEvent {
  const button = mouseButtonFromTrigger(event.trigger)
  if (!button) return event

  const actions = [...event.actions]
  const idx = actions.findIndex((a) => a.type === 'preventDefault')

  if (idx >= 0) {
    const existing = actions[idx]
    if (existing.type === 'preventDefault' && existing.button !== button) {
      actions[idx] = { ...existing, button }
    }
    if (idx !== 0) {
      const [pd] = actions.splice(idx, 1)
      actions.unshift(pd)
    }
    return { ...event, actions }
  }

  if (hasPreventDefaultForButton(actions, button)) return event

  return {
    ...event,
    actions: [defaultPreventDefaultAction(button), ...actions],
  }
}

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
