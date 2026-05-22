// ---------------------------------------------------------------------------
// Grouped type selector (triggers / actions / conditions) with friendly names
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import type { ComponentKind } from '../../utils/logic-board/schema-registry'
import {
  actionCategory,
  actionDisplayName,
  conditionCategory,
  conditionDisplayName,
  triggerDisplayName,
} from '../../panels/logic-board/friendly-labels'
import type { LogicActionType, LogicTriggerType } from '../../types/logic-board'
import type { LogicCondition } from '../../types/logic-board'
import {
  triggerExecutionTooltip,
  triggerPickerGroup,
} from '../../utils/logic-board/trigger-execution'

const sel =
  'w-full bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1.5 rounded text-xs'

function displayName(kind: ComponentKind, type: string): string {
  if (kind === 'trigger') return triggerDisplayName(type as LogicTriggerType)
  if (kind === 'action') return actionDisplayName(type as LogicActionType)
  return conditionDisplayName(type as LogicCondition['type'])
}

function category(kind: ComponentKind, type: string): string {
  if (kind === 'trigger') return triggerPickerGroup(type as LogicTriggerType)
  if (kind === 'action') return actionCategory(type as LogicActionType)
  return conditionCategory(type as LogicCondition['type'])
}

export function TypePicker({
  kind,
  types,
  value,
  onChange,
  className,
  recommendedTypes,
}: {
  kind: ComponentKind
  types: readonly string[]
  value: string
  onChange: (type: string) => void
  className?: string
  recommendedTypes?: readonly string[]
}) {
  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    const recommended = new Set(recommendedTypes ?? [])
    for (const t of types) {
      const cat = recommended.has(t) ? 'Recommended for this object' : category(kind, t)
      const list = map.get(cat) ?? []
      list.push(t)
      map.set(cat, list)
    }
    // Event-first triggers: Recommended before Advanced / Polling.
    const order = ['Recommended for this object', 'Recommended', 'Component APIs', 'Advanced / Polling']
    return [...map.entries()].sort(([a], [b]) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      if (ia >= 0 && ib >= 0) return ia - ib
      if (ia >= 0) return -1
      if (ib >= 0) return 1
      return a.localeCompare(b)
    })
  }, [kind, recommendedTypes, types])

  return (
    <select
      className={`${sel} ${className ?? ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {groups.map(([cat, items]) => (
        <optgroup key={cat} label={cat}>
          {items.map((t) => {
            const tip =
              kind === 'trigger'
                ? triggerExecutionTooltip(t as LogicTriggerType)
                : undefined
            return (
              <option key={t} value={t} title={tip}>
                {displayName(kind, t)}
              </option>
            )
          })}
        </optgroup>
      ))}
    </select>
  )
}
