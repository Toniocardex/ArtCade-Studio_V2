import type { ProjectDoc } from '../../../types'
import type {
  LogicCondition,
  LogicConditionNode,
} from '../../../types/logic-board'
import { formatKeyLabel } from '../../../components/logic-board/KeyCapture'
import { fmtClass, targetDisplayLabel } from './board-labels'

export function conditionSummaryPlain(
  c: LogicCondition,
  project?: ProjectDoc | null,
): string {
  switch (c.type) {
    case 'compareVariable':
      return `Score ${c.key} ${c.operator} ${c.value}`
    case 'compareClass':
      return `Touching "${fmtClass(c.className || '?', project)}"`
    case 'isKeyDown':
      return `${formatKeyLabel(c.keyCode)} is held`
    case 'hasTag':
      return `Has tag "${c.tag || '?'}"`
    case 'compareDistance':
      return `Distance to ${targetDisplayLabel(c.target, project)} ${c.operator} ${c.value}`
    case 'isMouseOver':
      return `Mouse is within ${c.radius ?? 32}px`
    case 'raycastHit':
      return c.className
        ? `Can see "${fmtClass(c.className, project)}" ahead`
        : 'Something ahead in line of sight'
    case 'chance':
      return `${c.percent}% chance`
    case 'isSpaceFree':
      return `Area (${c.x}, ${c.y}) is free`
    case 'compareHealth':
      return `${targetDisplayLabel(c.target, project)} ${c.field === 'max' ? 'max HP' : 'HP'} ${c.operator} ${c.value}`
    case 'isPlatformerGrounded':
      return `${targetDisplayLabel(c.target, project)} is on ground`
  }
}

/** Flatten condition tree to plain chips for collapsed card. */
export function conditionsPlainList(
  event: {
    onlyIfEnabled?: boolean
    conditions?: LogicCondition[]
    conditionRoot?: LogicConditionNode
  },
  project?: ProjectDoc | null,
): string[] {
  if (event.onlyIfEnabled === false) return []
  if (event.conditionRoot) {
    return flattenConditionNode(event.conditionRoot, project)
  }
  return (event.conditions ?? []).map((c) => conditionSummaryPlain(c, project))
}

function flattenConditionNode(
  node: LogicConditionNode,
  project?: ProjectDoc | null,
): string[] {
  if (node.kind === 'leaf') return [conditionSummaryPlain(node.condition, project)]
  return node.statements.flatMap((n) => flattenConditionNode(n, project))
}
