import type { ProjectDoc } from '../../../types'
import type {
  LogicCondition,
  LogicConditionEntry,
  LogicConditionNode,
} from '../../../types/logic-board'
import { formatKeyLabel } from '../../../components/logic-board/KeyCapture'
import { fmtClass, targetDisplayLabel } from './board-labels'
import { valueSummary } from './value-summary'

function formatChip(text: string, negated?: boolean): string {
  return negated ? `NOT ${text}` : text
}

export function conditionSummaryPlain(
  c: LogicCondition,
  project?: ProjectDoc | null,
  negated?: boolean,
): string {
  let text: string
  switch (c.type) {
    case 'compareVariable':
      text = `Variable ${c.key} ${c.operator} ${valueSummary(c.value, project)}`
      break
    case 'compareValues':
      text = `${valueSummary(c.left, project)} ${c.operator} ${valueSummary(c.right, project)}`
      break
    case 'compareClass':
      text = `Touching "${fmtClass(c.className || '?', project)}"`
      break
    case 'isKeyDown':
      text = `${formatKeyLabel(c.keyCode)} is held`
      break
    case 'hasTag':
      text = `Has tag "${c.tag || '?'}"`
      break
    case 'compareDistance':
      text = `Distance to ${targetDisplayLabel(c.target, project)} ${c.operator} ${c.value}`
      break
    case 'isMouseOver':
      text = `Mouse is within ${c.radius ?? 32}px`
      break
    case 'raycastHit':
      text = c.className
        ? `Can see "${fmtClass(c.className, project)}" ahead`
        : 'Something ahead in line of sight'
      break
    case 'chance':
      text = `${valueSummary(c.percent, project)}% chance`
      break
    case 'isTileAreaFree':
    case 'isSpaceFree':
      text = `Tile area (${valueSummary(c.x, project)}, ${valueSummary(c.y, project)}) is free`
      break
    case 'compareHealth':
      text = `${targetDisplayLabel(c.target, project)} ${c.field === 'max' ? 'max HP' : 'HP'} ${c.operator} ${valueSummary(c.value, project)}`
      break
    case 'isPlatformerGrounded':
      text = `${targetDisplayLabel(c.target, project)} is on ground`
      break
    case 'compareCount':
      text = `Count of "${fmtClass(c.className || '?', project)}" ${c.operator} ${valueSummary(c.value, project)}`
      break
    case 'entityExists':
      text = `${targetDisplayLabel(c.target, project)} exists`
      break
    case 'compareVelocity': {
      const axisLabel = c.axis === 'magnitude' ? 'speed' : `velocity.${c.axis}`
      text = `${targetDisplayLabel(c.target, project)} ${axisLabel} ${c.operator} ${valueSummary(c.value, project)}`
      break
    }
    case 'comparePosition': {
      const axisLabel = `position.${c.axis}`
      text = `${targetDisplayLabel(c.target, project)} ${axisLabel} ${c.operator} ${valueSummary(c.value, project)}`
      break
    }
    case 'saveExists':
      text = `Save slot "${c.slot || 'main'}" exists`
      break
    case 'isDialogActive':
      text = 'A dialog is active'
      break
  }
  return formatChip(text, negated)
}

/** Flatten condition tree to plain chips for collapsed card. */
export function conditionsPlainList(
  event: {
    onlyIfEnabled?: boolean
    conditions?: LogicConditionEntry[]
    conditionRoot?: LogicConditionNode
  },
  project?: ProjectDoc | null,
): string[] {
  if (event.onlyIfEnabled === false) return []
  if (event.conditionRoot) {
    return flattenConditionNode(event.conditionRoot, project)
  }
  return (event.conditions ?? []).map((c) =>
    conditionSummaryPlain(c, project, c.negated),
  )
}

function flattenConditionNode(
  node: LogicConditionNode,
  project?: ProjectDoc | null,
): string[] {
  if (node.kind === 'leaf') {
    return [conditionSummaryPlain(node.condition, project, node.negated)]
  }
  return node.statements.flatMap((n) => flattenConditionNode(n, project))
}
