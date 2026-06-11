// ---------------------------------------------------------------------------
// Per-check Pass / NOT (flat row or tree leaf)
// ---------------------------------------------------------------------------

import { CONDITION_POLARITY_OPTIONS } from '../../utils/logic-board/condition-combine'
import { EditorSelect } from '../ui/EditorSelect'

const POLARITY_OPTIONS = CONDITION_POLARITY_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

export type ConditionPolaritySelectProps = Readonly<{
  negated?: boolean
  onChange: (negated: boolean) => void
  /** Wrapper layout classes (width); visual style comes from EditorSelect. */
  className?: string
}>

export function ConditionPolaritySelect({
  negated,
  onChange,
  className = 'w-auto',
}: ConditionPolaritySelectProps) {
  return (
    <EditorSelect
      className={className}
      triggerClassName="py-1"
      value={negated ? 'not' : 'pass'}
      aria-label="Check polarity"
      onChange={(v) => onChange(v === 'not')}
      options={POLARITY_OPTIONS}
    />
  )
}
