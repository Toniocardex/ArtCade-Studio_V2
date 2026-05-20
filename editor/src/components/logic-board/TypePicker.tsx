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
  triggerCategory,
  triggerDisplayName,
} from '../../panels/logic-board/friendly-labels'
import type { LogicActionType, LogicTriggerType } from '../../types/logic-board'
import type { LogicCondition } from '../../types/logic-board'

const sel =
  'w-full bg-[var(--bg)] border border-[var(--border-2)] text-[var(--text)] px-2 py-1.5 rounded text-xs'

function displayName(kind: ComponentKind, type: string): string {
  if (kind === 'trigger') return triggerDisplayName(type as LogicTriggerType)
  if (kind === 'action') return actionDisplayName(type as LogicActionType)
  return conditionDisplayName(type as LogicCondition['type'])
}

function category(kind: ComponentKind, type: string): string {
  if (kind === 'trigger') return triggerCategory(type as LogicTriggerType)
  if (kind === 'action') return actionCategory(type as LogicActionType)
  return conditionCategory(type as LogicCondition['type'])
}

export function TypePicker({
  kind,
  types,
  value,
  onChange,
  className,
}: {
  kind: ComponentKind
  types: readonly string[]
  value: string
  onChange: (type: string) => void
  className?: string
}) {
  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const t of types) {
      const cat = category(kind, t)
      const list = map.get(cat) ?? []
      list.push(t)
      map.set(cat, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [kind, types])

  return (
    <select
      className={`${sel} ${className ?? ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {groups.map(([cat, items]) => (
        <optgroup key={cat} label={cat}>
          {items.map((t) => (
            <option key={t} value={t}>
              {displayName(kind, t)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
