import type { ProjectDoc } from '../../../types'
import type { LogicEvent } from '../../../types/logic-board'
import { actionSummaryPlain } from './summaries-action'
import { conditionsPlainList } from './summaries-condition'
import { eventTriggerSummaryPlain } from './summaries-trigger'

export interface RuleSentence {
  /** "When player presses Space" */
  when: string
  /** "if score >= 1, on ground" — empty string when no active checks. */
  checks: string
  /** "Play sound "jump.ogg" · Make self jump — else: 1 action" */
  actions: string
  /** True when the rule has no Then actions yet (incomplete rule). */
  missingActions: boolean
}

/**
 * Plain-language sentence parts for a collapsed rule card. Composes the
 * existing trigger/condition/action summaries so the rules list reads like
 * an event sheet without expanding each card.
 */
export function ruleSentenceParts(
  event: LogicEvent,
  project?: ProjectDoc | null,
): RuleSentence {
  const checks = conditionsPlainList(event, project)
  const actionTexts = event.actions.map((a) => actionSummaryPlain(a, project))

  const elseCount =
    event.elseEnabled !== false ? (event.elseActions?.length ?? 0) : 0
  const elseSuffix =
    elseCount > 0
      ? ` — else: ${elseCount} action${elseCount === 1 ? '' : 's'}`
      : ''

  return {
    when: eventTriggerSummaryPlain(event, project),
    checks: checks.length > 0 ? `if ${checks.join(', ')}` : '',
    actions:
      actionTexts.length > 0 ? `${actionTexts.join(' · ')}${elseSuffix}` : '',
    missingActions: actionTexts.length === 0,
  }
}
