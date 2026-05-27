import type { LogicAction } from '../../types/logic-board'

function isSequenceControl(a: LogicAction): boolean {
  return a.type === 'wait' || a.type === 'repeatTimes'
}

/**
 * Indices of actions that belong to a Repeat block's body (linear list semantics).
 * Mirrors resolveRepeatBody in emit-action-sequence.ts.
 */
export function repeatBodyIndices(actions: readonly LogicAction[]): Set<number> {
  const indices = new Set<number>()
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]
    if (a.type !== 'repeatTimes') continue
    if (a.actions?.length) continue
    let j = i + 1
    while (j < actions.length && !isSequenceControl(actions[j])) {
      indices.add(j)
      j++
    }
  }
  return indices
}
