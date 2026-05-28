// ---------------------------------------------------------------------------
// Per-check Pass / NOT (flat row or tree leaf)
// ---------------------------------------------------------------------------

import { CONDITION_POLARITY_OPTIONS } from '../../utils/logic-board/condition-combine'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'

export type ConditionPolaritySelectProps = Readonly<{
  negated?: boolean
  onChange: (negated: boolean) => void
  className?: string
}>

export function ConditionPolaritySelect({
  negated,
  onChange,
  className = sel,
}: ConditionPolaritySelectProps) {
  return (
    <select
      className={className}
      value={negated ? 'not' : 'pass'}
      aria-label="Check polarity"
      onChange={(e) => onChange(e.target.value === 'not')}
    >
      {CONDITION_POLARITY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
