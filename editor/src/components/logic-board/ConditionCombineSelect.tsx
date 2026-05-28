// ---------------------------------------------------------------------------
// Match rules / group operator — AND | OR | NOT
// ---------------------------------------------------------------------------

import {
  CONDITION_COMBINE_OPTIONS,
  type ConditionCombineOp,
} from '../../utils/logic-board/condition-combine'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'

export type ConditionCombineSelectProps = Readonly<{
  value: ConditionCombineOp
  onChange: (op: ConditionCombineOp) => void
  className?: string
  'aria-label'?: string
}>

export function ConditionCombineSelect({
  value,
  onChange,
  className = sel,
  'aria-label': ariaLabel = 'Match rules',
}: ConditionCombineSelectProps) {
  return (
    <select
      className={className}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as ConditionCombineOp)}
    >
      {CONDITION_COMBINE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
