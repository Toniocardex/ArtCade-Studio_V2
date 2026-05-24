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

/** Compact badge label for collapsed rule cards (Event vs Polling). */
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
  const label = polling ? 'Polling' : mode === 'hybrid' ? 'Event*' : 'Event'
  const title = polling
    ? 'This rule runs inside tick(dt) each frame or polls state.'
    : mode === 'hybrid'
      ? 'Event handler when configured; may fall back to polling.'
      : 'Registered once as an event handler (_logic_init).'
  return { label, title }
}

export function actionCategory(type: LogicActionType): string {
  return getComponentMeta('action', type)?.category ?? 'Other'
}

export function conditionCategory(type: LogicCondition['type']): string {
  return getComponentMeta('condition', type)?.category ?? 'Other'
}
