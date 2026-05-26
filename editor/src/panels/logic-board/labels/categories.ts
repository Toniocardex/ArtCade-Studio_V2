import type {
  LogicActionType,
  LogicCondition,
  LogicBoard,
  LogicEvent,
  LogicTriggerType,
} from '../../../types/logic-board'
import type { ProjectDoc } from '../../../types'
import { getComponentMeta } from '../../../utils/logic-board/schema-registry'
import {
  getTriggerExecutionMode,
  usesTickFallback,
} from '../../../utils/logic-board/trigger-execution'

export function triggerCategory(type: LogicTriggerType): string {
  return getComponentMeta('trigger', type)?.category ?? 'Other'
}

/** Compact badge label for collapsed rule cards. */
export function triggerExecutionBadge(
  event: LogicEvent,
  board?: LogicBoard | null,
  project?: ProjectDoc | null,
): { label: string; title: string } {
  const mode = getTriggerExecutionMode(
    event.trigger,
    board ?? undefined,
    event,
    project,
  )
  const polling = board
    ? usesTickFallback(event, board, project)
    : mode === 'polling'
  const label = polling
    ? 'Every frame'
    : mode === 'hybrid'
      ? 'Triggered*'
      : 'Triggered'
  const title = polling
    ? 'This rule is checked continuously while the game runs.'
    : mode === 'hybrid'
      ? 'This rule is triggered directly when available; otherwise it is checked while the game runs.'
      : 'This rule is triggered by the engine when it happens.'
  return { label, title }
}

export function actionCategory(type: LogicActionType): string {
  return getComponentMeta('action', type)?.category ?? 'Other'
}

export function conditionCategory(type: LogicCondition['type']): string {
  return getComponentMeta('condition', type)?.category ?? 'Other'
}
