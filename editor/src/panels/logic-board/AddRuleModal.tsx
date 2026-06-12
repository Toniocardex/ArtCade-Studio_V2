// ---------------------------------------------------------------------------
// AddRuleModal — trigger catalog for creating a new rule.
// Thin wrapper over CatalogPicker (search + categories + keyboard nav).
// ---------------------------------------------------------------------------

import type { LogicTriggerType } from '../../types/logic-board'
import { CatalogPicker } from '../../components/logic-board/CatalogPicker'

export type AddRuleModalProps = Readonly<{
  triggerTypes: readonly string[]
  /** Triggers highlighted as recommended for this rulesheet's target. */
  recommendedTypes?: readonly string[]
  onPick: (type: LogicTriggerType) => void
  onClose: () => void
}>

export function AddRuleModal({
  triggerTypes,
  recommendedTypes,
  onPick,
  onClose,
}: AddRuleModalProps) {
  return (
    <CatalogPicker
      kind="trigger"
      title="New rule — choose when it runs"
      subtitle="Pick a trigger. You can change it later, then add conditions and actions."
      searchPlaceholder="Search triggers… (key, touch, timer)"
      types={triggerTypes}
      recommendedTypes={recommendedTypes}
      onPick={(type) => onPick(type as LogicTriggerType)}
      onClose={onClose}
    />
  )
}
