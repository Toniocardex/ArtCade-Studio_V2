// ---------------------------------------------------------------------------
// Drop removed / internal-only action types when loading saved projects.
// ---------------------------------------------------------------------------

import type { LogicAction } from '../../types/logic-board'

const STRIPPED_ACTION_TYPES = new Set<string>(['preventDefault'])

export function stripLegacyLogicActions(
  actions: LogicAction[],
): LogicAction[] {
  return actions.flatMap((action): LogicAction[] => {
    if (STRIPPED_ACTION_TYPES.has(action.type)) return []
    switch (action.type) {
      case 'setVariableRandomRange':
        return [{
          type: 'setVariable',
          key: action.key,
          value: { source: 'random', min: action.min, max: action.max },
        }]
      case 'clearMovementIntent':
        return [{ type: 'moveController', target: action.target, direction: 'stop' }]
      case 'setCameraTarget':
        return [{ type: 'centerCameraOn', target: action.target }]
      case 'wait':
        return [{
          ...action,
          ...(action.then ? { then: stripLegacyLogicActions(action.then) } : {}),
        }]
      case 'repeatTimes':
        return [{
          ...action,
          ...(action.actions ? { actions: stripLegacyLogicActions(action.actions) } : {}),
        }]
      default:
        return [action]
    }
  })
}
