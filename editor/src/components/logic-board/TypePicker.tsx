// ---------------------------------------------------------------------------
// Grouped type selector (triggers / actions / conditions) with friendly names
// ---------------------------------------------------------------------------

import { useCallback, useMemo } from 'react'
import type { ComponentKind } from '../../utils/logic-board/schema-registry'
import {
  actionDisplayName,
  conditionDisplayName,
  triggerDisplayName,
} from '../../panels/logic-board/friendly-labels'
import type {
  LogicActionType,
  LogicCondition,
  LogicTriggerType,
} from '../../types/logic-board'
import { triggerExecutionTooltip } from '../../utils/logic-board/trigger-execution'
import { LogicTypeListbox } from './logic-type-listbox'
import { buildTypePickerGroups } from './type-picker-groups'

function displayName(kind: ComponentKind, type: string): string {
  if (kind === 'trigger') return triggerDisplayName(type as LogicTriggerType)
  if (kind === 'action') return actionDisplayName(type as LogicActionType)
  return conditionDisplayName(type as LogicCondition['type'])
}

export type TypePickerProps = Readonly<{
  kind: ComponentKind
  types: readonly string[]
  value: string
  onChange: (type: string) => void
  className?: string
  recommendedTypes?: readonly string[]
  /** Override group label for recommendedTypes (e.g. "Common checks"). */
  recommendedGroupLabel?: string
  /** Placeholder on trigger when no type selected yet (e.g. "Select action…"). */
  placeholder?: string
  placeholderValue?: string
}>

export function TypePicker({
  kind,
  types,
  value,
  onChange,
  className,
  recommendedTypes,
  recommendedGroupLabel,
  placeholder,
  placeholderValue = '',
}: TypePickerProps) {
  const groups = useMemo(
    () =>
      buildTypePickerGroups(kind, types, {
        recommendedTypes,
        recommendedGroupLabel,
      }),
    [kind, recommendedGroupLabel, recommendedTypes, types],
  )

  const resolveLabel = useCallback(
    (type: string) => displayName(kind, type),
    [kind],
  )

  const resolveTooltip = useCallback(
    (type: string) =>
      kind === 'trigger'
        ? triggerExecutionTooltip(type as LogicTriggerType)
        : undefined,
    [kind],
  )

  return (
    <LogicTypeListbox
      groups={groups}
      value={value}
      onChange={onChange}
      className={className}
      placeholder={placeholder}
      placeholderValue={placeholderValue}
      resolveLabel={resolveLabel}
      resolveTooltip={resolveTooltip}
    />
  )
}
