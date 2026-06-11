// ---------------------------------------------------------------------------
// Match rules / group operator — AND | OR | NOT
// ---------------------------------------------------------------------------

import {
  CONDITION_COMBINE_OPTIONS,
  type ConditionCombineOp,
} from '../../utils/logic-board/condition-combine'
import { EditorSelect } from '../ui/EditorSelect'

const COMBINE_OPTIONS = CONDITION_COMBINE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

export type ConditionCombineSelectProps = Readonly<{
  value: ConditionCombineOp
  onChange: (op: ConditionCombineOp) => void
  /** Wrapper layout classes (width); visual style comes from EditorSelect. */
  className?: string
  'aria-label'?: string
}>

export function ConditionCombineSelect({
  value,
  onChange,
  className = 'w-auto',
  'aria-label': ariaLabel = 'Match rules',
}: ConditionCombineSelectProps) {
  return (
    <EditorSelect
      className={className}
      triggerClassName="py-1"
      value={value}
      aria-label={ariaLabel}
      onChange={(op) => onChange(op as ConditionCombineOp)}
      options={COMBINE_OPTIONS}
    />
  )
}
