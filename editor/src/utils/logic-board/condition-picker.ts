// ---------------------------------------------------------------------------
// Condition type lists for artist-first Logic Board UI (see LOGIC_BOARD_UX_CHARTER)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../../types'
import type { AuthoringMode } from '../../types/authoring-mode'
import type {
  LogicBoard,
  LogicCondition,
  LogicConditionNode,
  LogicEvent,
  LogicTrigger,
} from '../../types/logic-board'
import type { ComponentKey } from '../../types/components'
import { logicBoardTargetEntityIds } from '../project-queries'
import { CONDITION_TYPES } from '../../panels/logic-board/options'

/** Shown first in the condition picker (tier 1–2). */
export const COMMON_CONDITION_TYPES: readonly LogicCondition['type'][] = [
  'compareClass',
  'isPlatformerGrounded',
  'compareHealth',
  'chance',
]

const CONDITION_RECOMMENDATIONS: Partial<
  Record<ComponentKey, LogicCondition['type'][]>
> = {
  platformerController: ['isPlatformerGrounded'],
  health: ['compareHealth'],
}

function targetEntityIds(project: ProjectDoc, board: LogicBoard): number[] {
  return logicBoardTargetEntityIds(project, board)
}

function entityHasComponent(
  project: ProjectDoc,
  entityId: number,
  key: ComponentKey,
): boolean {
  return project.entities?.[entityId]?.[key] != null
}

function leafTypesFromNode(node: LogicConditionNode): LogicCondition['type'][] {
  if (node.kind === 'leaf') return [node.condition.type]
  return node.statements.flatMap(leafTypesFromNode)
}

/** Leaf condition types already on the event (always keep in picker). */
export function conditionTypesInUse(event: LogicEvent): LogicCondition['type'][] {
  const fromFlat = (event.conditions ?? []).map((c) => c.type)
  const fromTree = event.conditionRoot
    ? leafTypesFromNode(event.conditionRoot)
    : []
  return [...new Set([...fromFlat, ...fromTree])]
}

/** Types available in pickers for this trigger (contextual guidance in Base). */
export function conditionTypesForTrigger(
  trigger: LogicTrigger,
  all: readonly LogicCondition['type'][] = CONDITION_TYPES,
  authoringMode: AuthoringMode = 'base',
  preserveTypes: readonly LogicCondition['type'][] = [],
): LogicCondition['type'][] {
  let types =
    authoringMode === 'base' && trigger.type === 'onInput'
      ? all.filter((t) => t !== 'isKeyDown')
      : [...all]
  for (const t of preserveTypes) {
    if (!types.includes(t)) types = [...types, t]
  }
  return types
}

function addCommonConditionTypes(
  out: Set<LogicCondition['type']>,
  allowed: Set<LogicCondition['type']>,
): void {
  for (const t of COMMON_CONDITION_TYPES) {
    if (allowed.has(t)) out.add(t)
  }
}

function addComponentBackedConditionTypes(
  out: Set<LogicCondition['type']>,
  allowed: Set<LogicCondition['type']>,
  project: ProjectDoc,
  board: LogicBoard,
): void {
  const ids = targetEntityIds(project, board)
  for (const key of Object.keys(CONDITION_RECOMMENDATIONS) as ComponentKey[]) {
    const types = CONDITION_RECOMMENDATIONS[key]
    if (!types || !ids.some((id) => entityHasComponent(project, id, key))) continue
    for (const t of types) {
      if (allowed.has(t)) out.add(t)
    }
  }
}

/** Highlighted at top of condition TypePicker. */
export function recommendedConditionTypes(
  trigger: LogicTrigger,
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
  authoringMode: AuthoringMode = 'base',
): LogicCondition['type'][] {
  const allowed = new Set(
    conditionTypesForTrigger(trigger, CONDITION_TYPES, authoringMode, []),
  )
  const out = new Set<LogicCondition['type']>()
  addCommonConditionTypes(out, allowed)
  if (project && board) {
    addComponentBackedConditionTypes(out, allowed, project, board)
  }
  return [...out]
}
