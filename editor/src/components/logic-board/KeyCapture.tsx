// ---------------------------------------------------------------------------
// Modal key capture — stores KeyboardEvent.code (Space, KeyW, …)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'

const btn =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs min-w-[7rem]'

export function formatKeyLabel(code: string): string {
  if (!code) return '—'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Arrow')) return code.slice(5)
  return code
}

export interface KeyCaptureProps {
  value: string
  onChange: (code: string) => void
  placeholder?: string
}

export function KeyCapture({ value, onChange, placeholder }: KeyCaptureProps) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

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
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onChange, close])

  const label = value ? formatKeyLabel(value) : placeholder ?? 'Press key…'

  return (
    <>
      <button type="button" className={btn} onClick={() => setOpen(true)} title={value || undefined}>
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
          onClick={close}
          role="presentation"
        >
          <div
            className="bg-[var(--panel)] border border-[var(--border-2)] rounded px-6 py-4 text-center"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Capture key"
          >
            <p className="text-sm text-[var(--text)] mb-1">Press any key</p>
            <p className="text-[10px] text-[var(--muted)]">Esc to cancel</p>
          </div>
        </div>
      )}
    </>
  )
}
