// ---------------------------------------------------------------------------
// Deep-clone helpers for Logic Board copy/duplicate workflows.
// ---------------------------------------------------------------------------

import type { LogicAction, LogicEvent } from '../../types/logic-board'
import { logicId } from './factory'

export function cloneLogicEvent(event: LogicEvent): LogicEvent {
  const next = structuredClone(event)
  next.id = logicId('evt')
  return next
}

export function cloneLogicAction(action: LogicAction): LogicAction {
  return structuredClone(action)
}
