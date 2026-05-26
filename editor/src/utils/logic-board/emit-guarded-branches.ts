// ---------------------------------------------------------------------------
// Enable wrapper + condition if/else + action emission (Then / Else)
// ---------------------------------------------------------------------------

import type { LogicEvent } from '../../types/logic-board'
import { conditionExpr } from './condition-expr'
import { eventUsesElseBranch } from './event-conditions'
import { emitActionSequence } from './emit-action-sequence'
import { INDENT } from './lua-helpers'
import { ruleKeyExpr } from './event-slugs'

export type EmitGuardedBranchesOptions = {
  /** Extra AND clause merged into the inner condition (e.g. onInput AND combo). */
  triggerGate?: string | null
  /** Skip `_logic_on` wrapper (caller already gates enable on an outer if). */
  skipEnable?: boolean
}

function innerConditionGuard(
  ev: LogicEvent,
  triggerGate?: string | null,
): string {
  const cond = conditionExpr(ev)
  if (!triggerGate) return cond
  if (cond === 'true') return triggerGate
  return `${triggerGate} and (${cond})`
}

/**
 * Emit Then actions, optional Else, gated by Also require… and rule enable.
 *
 * ```lua
 * if _logic_on[RULE.id] ~= false then
 *   if <conditions> then
 *     -- then
 *   else
 *     -- else
 *   end
 * end
 * ```
 */
export function emitGuardedBranches(
  ev: LogicEvent,
  baseIndent: string,
  slugs: Map<string, string>,
  options: EmitGuardedBranchesOptions = {},
): string[] {
  const I = INDENT
  const enableGuard = `_logic_on[${ruleKeyExpr(ev.id, slugs)}] ~= false`
  const innerGuard = innerConditionGuard(ev, options.triggerGate ?? null)
  const useElse = eventUsesElseBranch(ev)

  const thenLines = emitActionSequence(ev.actions, baseIndent + I, slugs)
  const elseLines = useElse
    ? emitActionSequence(ev.elseActions ?? [], baseIndent + I, slugs)
    : []

  const bodyIndent = baseIndent + I
  let conditionBlock: string[]

  if (useElse) {
    conditionBlock = [
      `${bodyIndent}if ${innerGuard} then`,
      ...thenLines,
      `${bodyIndent}else`,
      ...elseLines,
      `${bodyIndent}end`,
    ]
  } else if (innerGuard === 'true') {
    conditionBlock = thenLines
  } else {
    conditionBlock = [
      `${bodyIndent}if ${innerGuard} then`,
      ...thenLines,
      `${bodyIndent}end`,
    ]
  }

  if (options.skipEnable) return conditionBlock

  return [
    `${baseIndent}if ${enableGuard} then`,
    ...conditionBlock,
    `${baseIndent}end`,
  ]
}

/** Registration/tick entry — same as emitGuardedBranches with trigger gate. */
export function emitGuardedActions(
  ev: LogicEvent,
  baseIndent: string,
  slugs: Map<string, string>,
  triggerAndGate?: string | null,
): string[] {
  return emitGuardedBranches(ev, baseIndent, slugs, {
    triggerGate: triggerAndGate ?? null,
  })
}
