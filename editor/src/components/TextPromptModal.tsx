import { useEffect, useRef, useState } from 'react'
import {
  completeTextPrompt,
  getTextPromptRequest,
  subscribeTextPrompt,
} from '../utils/text-prompt'

/** Themed single-line prompt — replaces native Win32 input for editor UX. */
export function TextPromptModal() {
  const [, bump] = useState(0)
  const request = getTextPromptRequest()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dismissKindRef = useRef<'submit' | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => subscribeTextPrompt(() => bump((n) => n + 1)), [])

  useEffect(() => {
    if (!request) return
    setDraft(request.options.defaultValue ?? '')
  }, [request?.id, request?.options.defaultValue])

  useEffect(() => {
    if (!request) return
    const el = dialogRef.current
    if (!el) return
    if (!el.open) el.showModal()
    const id = globalThis.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => globalThis.cancelAnimationFrame(id)
  }, [request?.id])

  useEffect(() => {
    if (!request) return
    const el = dialogRef.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      completeTextPrompt(null)
    }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  }, [request?.id])

  if (!request) return null

  const { title, message } = request.options

  const submit = () => {
    const trimmed = draft.trim()
    dismissKindRef.current = 'submit'
    dialogRef.current?.close()
    completeTextPrompt(trimmed.length > 0 ? trimmed : null)
  }

  const cancel = () => {
    completeTextPrompt(null)
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="text-prompt-title"
      aria-describedby="text-prompt-message"
      aria-modal
      className="artcade-dialog fixed inset-0 z-[210] m-0 flex h-full max-h-full w-full max-w-full items-center justify-center border-0 bg-transparent p-6 backdrop:bg-black/60"
      onClose={() => {
        if (dismissKindRef.current === 'submit') {
          dismissKindRef.current = null
          return
        }
        completeTextPrompt(null)
      }}
    >
      <form
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-2xl overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <header className="px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-2)]">
          <h2 id="text-prompt-title" className="text-sm font-semibold text-[var(--text)]">
            {title}
          </h2>
        </header>
        <div className="px-4 py-4 space-y-3">
          <label id="text-prompt-message" className="block text-[11px] text-[var(--muted)]">
            {message}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full px-3 py-2 rounded border border-[var(--border-2)] bg-[var(--bg)]
                       text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            autoComplete="off"
          />
        </div>
        <footer className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-2)]">
          <button
            type="button"
            onClick={cancel}
            className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--muted)]
                       hover:text-[var(--text)] hover:border-[var(--border-2)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold rounded border border-[var(--accent-bd)]
                       bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
          >
            OK
          </button>
        </footer>
      </form>
    </dialog>
  )
}
