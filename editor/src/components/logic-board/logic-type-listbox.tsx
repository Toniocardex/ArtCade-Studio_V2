// ---------------------------------------------------------------------------
// Logic Board type-picker adapter over the shared EditorSelect listbox.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { EditorSelect } from '../ui/EditorSelect'
import type { TypePickerGroup } from './type-picker-groups'

export type LogicTypeListboxProps = Readonly<{
  groups: readonly TypePickerGroup[]
  value: string
  onChange: (type: string) => void
  className?: string
  placeholder?: string
  placeholderValue?: string
  resolveLabel: (type: string) => string
  resolveTooltip?: (type: string) => string | undefined
}>

export function LogicTypeListbox({
  groups,
  value,
  onChange,
  className = 'w-full',
  placeholder,
  placeholderValue = '',
  resolveLabel,
  resolveTooltip,
}: LogicTypeListboxProps) {
  const selectGroups = useMemo(
    () =>
      groups.map((group) => ({
        label: group.label,
        options: group.types.map((type) => ({
          value: type,
          label: resolveLabel(type),
          title: resolveTooltip?.(type),
        })),
      })),
    [groups, resolveLabel, resolveTooltip],
  )

  const showingPlaceholder = value === '' || value === placeholderValue

  return (
    <EditorSelect
      groups={selectGroups}
      value={showingPlaceholder ? '' : value}
      onChange={onChange}
      className={className}
      placeholder={placeholder ?? 'Select…'}
    />
  )
}
