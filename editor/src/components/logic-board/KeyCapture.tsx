// ---------------------------------------------------------------------------
// Modal key capture — stores KeyboardEvent.code (Space, KeyW, …)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react'

const btn =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs min-w-[7rem]'

export function formatKeyLabel(code: string): string {
  if (!code) return '—'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Arrow')) return code.slice(5)
  return code
}

export type KeyCaptureProps = Readonly<{
  value: string
  onChange: (code: string) => void
  placeholder?: string
}>

export function KeyCapture({ value, onChange, placeholder }: KeyCaptureProps) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      if (!el.open) el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [open])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const onDialogClose = () => setOpen(false)
    const onCancel = (e: Event) => {
      e.preventDefault()
      close()
    }
    el.addEventListener('close', onDialogClose)
    el.addEventListener('cancel', onCancel)
    return () => {
      el.removeEventListener('close', onDialogClose)
      el.removeEventListener('cancel', onCancel)
    }
  }, [close])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') {
        close()
        return
      }
      if (e.code) {
        onChange(e.code)
        close()
      }
    }
    globalThis.addEventListener('keydown', onKey, true)
    return () => globalThis.removeEventListener('keydown', onKey, true)
  }, [open, onChange, close])

  const label = value ? formatKeyLabel(value) : placeholder ?? 'Press key…'

  return (
    <>
      <button type="button" className={btn} onClick={() => setOpen(true)} title={value || undefined}>
        {label}
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Capture key"
        className="fixed inset-0 z-[200] m-0 flex h-full max-h-full w-full max-w-full items-center justify-center border-0 bg-transparent p-6 backdrop:bg-black/50 open:flex"
      >
        <div className="bg-[var(--panel)] border border-[var(--border-2)] rounded px-6 py-4 text-center">
          <p className="text-sm text-[var(--text)] mb-1">Press any key</p>
          <p className="text-[10px] text-[var(--muted)]">Esc to cancel</p>
        </div>
      </dialog>
    </>
  )
}
