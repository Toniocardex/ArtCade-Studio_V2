import { useEffect, useRef, useState } from 'react'
import {
  completeChoicePrompt,
  getChoicePromptRequest,
  subscribeChoicePrompt,
} from '../utils/choice-prompt'

/**
 * Themed multi-choice modal for unsaved guards (Save All / Discard / Cancel).
 */
export function ChoicePromptModal() {
  const [, bump] = useState(0)
  const prompt = getChoicePromptRequest()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => subscribeChoicePrompt(() => bump((n) => n + 1)), [])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (prompt && !el.open) el.showModal()
    if (!prompt && el.open) el.close()
  }, [prompt?.id])

  if (!prompt) return null

  const { title, message, choices, cancelId } = prompt.options

  return (
    <dialog
      ref={dialogRef}
      data-testid="choice-prompt-modal"
      className="fixed inset-0 z-[120] m-auto w-[min(92vw,28rem)] rounded border border-[var(--outline)]
                 bg-[var(--panel)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-black/50"
      onCancel={(event) => {
        event.preventDefault()
        completeChoicePrompt(cancelId)
      }}
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--accent)]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap">
            {message}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:flex-wrap">
          {choices.map((choice) => {
            const isPrimary = choice.kind === 'primary'
            const isDanger = choice.kind === 'danger'
            return (
              <button
                key={choice.id}
                type="button"
                data-testid={`choice-prompt-${choice.id}`}
                className={
                  isPrimary
                    ? 'rounded border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black'
                    : isDanger
                      ? 'rounded border border-[var(--danger,var(--outline))] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--danger,#f87171)]'
                      : 'rounded border border-[var(--outline)] px-3 py-2 text-xs font-semibold uppercase tracking-wide'
                }
                onClick={() => completeChoicePrompt(choice.id)}
              >
                {choice.label}
              </button>
            )
          })}
        </div>
      </div>
    </dialog>
  )
}
