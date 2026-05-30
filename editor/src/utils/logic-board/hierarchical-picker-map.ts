import type { ComponentKind } from './schema-registry'
import type { LogicActionType, LogicCondition, LogicTriggerType } from '../../types/logic-board'
import {
  actionCategory,
  actionDisplayName,
  conditionCategory,
  conditionDisplayName,
  triggerDisplayName,
} from '../../panels/logic-board/friendly-labels'
import { triggerPickerGroup } from './trigger-execution'

export type HierarchicalNode = Readonly<{
  id: string
  label: string
  children?: readonly HierarchicalNode[]
}>

function mapTypes<T extends string>(
  kind: ComponentKind,
  types: readonly T[],
  categoryFn: (type: T) => string,
  labelFn: (type: T) => string,
): readonly HierarchicalNode[] {
  const byCat = new Map<string, T[]>()
  for (const t of types) {
    const cat = categoryFn(t)
    const list = byCat.get(cat) ?? []
    list.push(t)
    byCat.set(cat, list)
  }
  return [...byCat.entries()].map(([cat, list]) => ({
    id: `${kind}:${cat}`,
    label: cat,
    children: list.map((type) => ({
      id: type,
      label: labelFn(type),
    })),
  }))
}

export function triggerHierarchy(types: readonly LogicTriggerType[]): readonly HierarchicalNode[] {
  return mapTypes('trigger', types, triggerPickerGroup, (t) => triggerDisplayName(t))
}

export function actionHierarchy(types: readonly LogicActionType[]): readonly HierarchicalNode[] {
  return mapTypes('action', types, actionCategory, (t) => actionDisplayName(t))
}

export function conditionHierarchy(types: readonly LogicCondition['type'][]): readonly HierarchicalNode[] {
  return mapTypes('condition', types, conditionCategory, (t) => conditionDisplayName(t))
}
