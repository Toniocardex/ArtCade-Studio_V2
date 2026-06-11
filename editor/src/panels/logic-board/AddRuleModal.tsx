// ---------------------------------------------------------------------------
// AddRuleModal — categorized trigger catalog for creating a new rule.
// Native <dialog>; pick a trigger and the rule is created and opened inline.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { LogicTriggerType } from '../../types/logic-board'
import { buildTypePickerGroups } from '../../components/logic-board/type-picker-groups'
import { triggerDisplayName } from './friendly-labels'
import { triggerExecutionTooltip } from '../../utils/logic-board/trigger-execution'

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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const groups = buildTypePickerGroups('trigger', triggerTypes, {
    recommendedTypes,
  })

  useEffect(() => {
    const el = dialogRef.current
    if (el && !el.open) el.showModal()
  }, [])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="add-rule-title"
      aria-modal
      className="artcade-dialog fixed inset-0 z-[210] m-0 flex h-full max-h-full w-full max-w-full items-center justify-center border-0 bg-transparent p-6 backdrop:bg-black/60"
      onClick={(e) => {
        // Backdrop click: the dialog element itself is the click target only
        // when the click lands outside the inner card.
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-3">
          <div>
            <h2 id="add-rule-title" className="text-sm font-semibold">
              New rule — choose when it runs
            </h2>
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">
              Pick a trigger. You can change it later, then add conditions and actions.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--panel-3)] hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-auto panel-scroll px-4 py-3">
          {groups.map((group) => (
            <section key={group.label} className="mb-4 last:mb-1">
              <h3 className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                {group.label}
              </h3>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {group.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    title={triggerExecutionTooltip(type as LogicTriggerType)}
                    onClick={() => onPick(type as LogicTriggerType)}
                    className="rounded border border-[var(--border-2)] bg-[var(--bg)] px-2.5 py-2 text-left text-[11px] text-[var(--primary)] transition-colors hover:border-[var(--accent-bd)] hover:bg-[var(--panel-2)]"
                  >
                    {triggerDisplayName(type as LogicTriggerType)}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  )
}
