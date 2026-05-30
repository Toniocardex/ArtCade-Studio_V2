import { useMemo } from 'react'
import type { LogicBoard } from '../../types/logic-board'
import { SectionCollapse } from '../../components/ui/SectionCollapse'

/** Derived variable names from compareVariable / setVariable actions (read-only view). */
export function LogicVariablesPanel({ board }: Readonly<{ board: LogicBoard | null }>) {
  const names = useMemo(() => {
    if (!board) return []
    const set = new Set<string>()
    for (const ev of board.events) {
      for (const a of ev.actions) {
        if (a.type === 'setVariable' && a.key?.trim()) set.add(a.key.trim())
        if (a.type === 'addVariable' && a.key?.trim()) set.add(a.key.trim())
      }
      for (const c of ev.conditions ?? []) {
        if (c.type === 'compareVariable' && c.key?.trim()) set.add(c.key.trim())
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [board])

  return (
    <SectionCollapse title="Variables" defaultOpen={names.length > 0}>
      {names.length === 0 ? (
        <p className="text-[10px] text-[var(--muted)] px-1">
          Variables appear when rules use Set variable or Compare variable.
        </p>
      ) : (
        <ul className="text-[10px] font-mono text-[var(--primary-soft)] space-y-0.5">
          {names.map((n) => (
            <li key={n} className="truncate px-1">
              {n}
            </li>
          ))}
        </ul>
      )}
    </SectionCollapse>
  )
}
