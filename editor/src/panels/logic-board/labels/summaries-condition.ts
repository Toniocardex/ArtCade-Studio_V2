import type { ProjectDoc } from '../../../types'
import type {
  LogicCondition,
  LogicConditionEntry,
  LogicConditionNode,
} from '../../../types/logic-board'
import { formatKeyLabel } from '../../../components/logic-board/KeyCapture'
import { fmtClass, targetDisplayLabel } from './board-labels'

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
      text = `Score ${c.key} ${c.operator} ${c.value}`
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
      text = `${c.percent}% chance`
      break
    case 'isSpaceFree':
      text = `Area (${c.x}, ${c.y}) is free`
      break
    case 'compareHealth':
      text = `${targetDisplayLabel(c.target, project)} ${c.field === 'max' ? 'max HP' : 'HP'} ${c.operator} ${c.value}`
      break
    case 'isPlatformerGrounded':
      text = `${targetDisplayLabel(c.target, project)} is on ground`
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
