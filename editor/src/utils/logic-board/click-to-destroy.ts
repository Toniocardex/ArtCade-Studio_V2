// ---------------------------------------------------------------------------
// "Click to destroy" — Logic Board action + trigger sync helpers.
// Browser default suppression for right-click is editor-only (PreviewPanel).
// ---------------------------------------------------------------------------

import type { LogicAction, LogicBoard, LogicEvent } from '../../types/logic-board'
import { createLogicEvent } from './factory'

type ClickToDestroyAction = Extract<LogicAction, { type: 'clickToDestroy' }>

export function isEntityBoardTarget(target: LogicBoard['target']): boolean {
  return (
    target.type === 'entity_id' ||
    target.type === 'entity_class' ||
    target.type === 'object_type'
  )
}

export function collectClickToDestroyActions(
  actions: readonly LogicAction[],
): ClickToDestroyAction[] {
  return actions.filter((a): a is ClickToDestroyAction => a.type === 'clickToDestroy')
}

export function eventClickToDestroyCount(event: LogicEvent): number {
  const main = collectClickToDestroyActions(event.actions).length
  const elseBranch = event.elseActions
    ? collectClickToDestroyActions(event.elseActions).length
    : 0
  return main + elseBranch
}

export interface ClickToDestroyCompatibilityError {
  eventId: string
  message: string
}

export function findClickToDestroyErrors(
  board: LogicBoard,
): ClickToDestroyCompatibilityError[] {
  const errors: ClickToDestroyCompatibilityError[] = []
  const entityBoard = isEntityBoardTarget(board.target)

  for (const ev of board.events) {
    if (!entityBoard && eventClickToDestroyCount(ev) > 0) {
      errors.push({
        eventId: ev.id,
        message:
          'Click to destroy is only allowed on entity rulesheets (not global or scene boards).',
      })
      continue
    }
    if (collectClickToDestroyActions(ev.actions).length > 1) {
      errors.push({
        eventId: ev.id,
        message: 'Only one Click to destroy action is allowed per rule (Then branch).',
      })
    }
    if (ev.elseActions && collectClickToDestroyActions(ev.elseActions).length > 0) {
      errors.push({
        eventId: ev.id,
        message: 'Click to destroy cannot be used in the Else branch.',
      })
    }
  }
  return errors
}

/** Compiler-side assertion — invalid clickToDestroy placement fails before emit. */
export function assertClickToDestroyCompatible(board: LogicBoard): void {
  const errors = findClickToDestroyErrors(board)
  if (errors.length === 0) return
  const detail = errors
    .map((e) => `  • event "${e.eventId}": ${e.message}`)
    .join('\n')
  throw new Error(
    `Logic Board "${board.boardId}" has invalid Click to destroy usage:\n${detail}`,
  )
}

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
