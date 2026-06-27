import { useEffect, useRef, useState } from 'react'
import {
  completeProjectSaveRecoveryChoice,
  getProjectSaveRecoveryPrompt,
  subscribeProjectSaveRecoveryPrompt,
} from '../utils/project-save-recovery-prompt'

export function ProjectSaveRecoveryModal() {
  const [, bump] = useState(0)
  const prompt = getProjectSaveRecoveryPrompt()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => subscribeProjectSaveRecoveryPrompt(() => bump((n) => n + 1)), [])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (prompt && !el.open) el.showModal()
    if (!prompt && el.open) el.close()
  }, [prompt?.id])

  if (!prompt) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[120] m-auto w-[min(92vw,28rem)] rounded-lg border border-[var(--border-2)]
                 bg-[var(--panel)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-black/50"
      onCancel={(event) => {
        event.preventDefault()
        completeProjectSaveRecoveryChoice('saved')
      }}
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--accent)]">
            Recovery file found
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
            A newer {prompt.recoveryLabel} was found while opening this project.
            Choose which version to open.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-[var(--muted)] break-all">
          <div>
            <span className="font-semibold text-[var(--text)]">Recovery:</span>{' '}
            {prompt.recoveryPath}
          </div>
          <div>
            <span className="font-semibold text-[var(--text)]">Saved project:</span>{' '}
            {prompt.savedPath}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded border border-[var(--border-2)] px-3 py-2 text-xs font-semibold uppercase tracking-wide"
            onClick={() => completeProjectSaveRecoveryChoice('discard')}
          >
            Discard recovery
          </button>
          <button
            type="button"
            className="rounded border border-[var(--border-2)] px-3 py-2 text-xs font-semibold uppercase tracking-wide"
            onClick={() => completeProjectSaveRecoveryChoice('saved')}
          >
            Open saved project
          </button>
          <button
            type="button"
            className="rounded border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black"
            onClick={() => completeProjectSaveRecoveryChoice('recovery')}
          >
            Open recovery
          </button>
        </div>
      </div>
    </dialog>
  )
}
