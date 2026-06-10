// ---------------------------------------------------------------------------
// TypePicker group builder — pure logic for trigger/action/condition buckets.
// ---------------------------------------------------------------------------

import {
  actionCategory,
  conditionCategory,
} from '../../panels/logic-board/friendly-labels'
import type {
  LogicActionType,
  LogicCondition,
  LogicTriggerType,
} from '../../types/logic-board'
import type { ComponentKind } from '../../utils/logic-board/schema-registry'
import { triggerPickerGroup } from '../../utils/logic-board/trigger-execution'

export type TypePickerGroup = Readonly<{
  label: string
  types: readonly string[]
}>

const GROUP_ORDER = [
  'Common checks',
  'Recommended for this object',
  'Time',
  'Object state',
  'Contact',
  'Zones',
  'Input',
  'Animation',
  'Game messages',
  'Every frame',
  'Recommended',
  'Movement',
  'Health',
  'AI Logic',
  'Lifecycle',
  'Audio',
  'Advanced',
] as const

function categoryForType(kind: ComponentKind, type: string): string {
  if (kind === 'trigger') return triggerPickerGroup(type as LogicTriggerType)
  if (kind === 'action') return actionCategory(type as LogicActionType)
  return conditionCategory(type as LogicCondition['type'])
}

function sortGroupLabels(a: string, b: string): number {
  const ia = GROUP_ORDER.indexOf(a as (typeof GROUP_ORDER)[number])
  const ib = GROUP_ORDER.indexOf(b as (typeof GROUP_ORDER)[number])
  if (ia >= 0 && ib >= 0) return ia - ib
  if (ia >= 0) return -1
  if (ib >= 0) return 1
  return a.localeCompare(b)
}

export type BuildTypePickerGroupsOptions = Readonly<{
  recommendedTypes?: readonly string[]
  recommendedGroupLabel?: string
}>

/**
 * Builds ordered category groups for Logic Board type pickers.
 * @param kind trigger, action, or condition catalog
 * @param types allowed type ids for this picker instance
 * @param options optional recommended bucket label and member types
 */
export function buildTypePickerGroups(
  kind: ComponentKind,
  types: readonly string[],
  options?: BuildTypePickerGroupsOptions,
): readonly TypePickerGroup[] {
  const recommendedLabel =
    options?.recommendedGroupLabel ??
    (kind === 'condition' ? 'Common checks' : 'Recommended for this object')
  const recommended = new Set(options?.recommendedTypes ?? [])
  const map = new Map<string, string[]>()

  for (const type of types) {
    const label = recommended.has(type) ? recommendedLabel : categoryForType(kind, type)
    const list = map.get(label) ?? []
    list.push(type)
    map.set(label, list)
  }

  return [...map.entries()]
    .sort(([a], [b]) => sortGroupLabels(a, b))
    .map(([label, groupTypes]) => ({ label, types: groupTypes }))
}

/**
 * Flat list of selectable types in the same order as grouped listbox rows.
 */
export function flattenTypePickerGroups(
  groups: readonly TypePickerGroup[],
): readonly string[] {
  return groups.flatMap((g) => g.types)
}
