// ---------------------------------------------------------------------------
// Drop removed / internal-only action types when loading saved projects.
// ---------------------------------------------------------------------------

import type { LogicAction } from '../../types/logic-board'

const STRIPPED_ACTION_TYPES = new Set<string>(['preventDefault'])

export function stripLegacyLogicActions(
  actions: LogicAction[],
): LogicAction[] {
  return actions.filter((a) => !STRIPPED_ACTION_TYPES.has(a.type))
}
