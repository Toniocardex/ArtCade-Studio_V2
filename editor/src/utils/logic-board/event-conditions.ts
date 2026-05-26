// ---------------------------------------------------------------------------
// Also require… / Else eligibility — shared by editor UI and validation
// ---------------------------------------------------------------------------

import type { LogicEvent } from '../../types/logic-board'

/** True when the event has an active Also require… block with at least one check. */
export function eventHasConditionBlock(ev: LogicEvent): boolean {
  if (ev.onlyIfEnabled === false) return false
  if (ev.conditionRoot != null) return true
  return (ev.conditions?.length ?? 0) > 0
}

/** Else branch is allowed and enabled in the saved event. */
export function eventUsesElseBranch(ev: LogicEvent): boolean {
  return ev.elseEnabled === true && eventHasConditionBlock(ev)
}
