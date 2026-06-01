// ---------------------------------------------------------------------------
// inspector-fields — collapsible section + text/number field primitives
// ---------------------------------------------------------------------------
//
// Extracted from InspectorPanel.tsx during Phase 3 of the technical-debt
// split (see docs/TECHNICAL_DEBT_REVIEW.md). Every Inspector section uses the
// same chrome (caret + bordered title) and the same text/number inputs;
// keeping them here avoids re-implementing keyboard handling per section.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { applyInputBackspace, isBackspaceKey } from '../../utils/keyboard'
export { snapToGridValue } from '../../utils/entity-position'

export type InspectorSectionProps = Readonly<{
  label: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}>

export function InspectorSection({
  label,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
}: InspectorSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  function setOpen(next: boolean) {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-[10px] text-[var(--muted)]
                   hover:text-[var(--text)] font-bold border-b border-[var(--border)] pb-1 mb-2
                   uppercase tracking-widest transition-colors"
      >
        <span>{label}</span>
        <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

export type FieldProps = Readonly<{
  label: string
  value: string | number
  onCommit?: (value: string) => void
  cyan?: boolean
}>

export function Field({
  label, value, onCommit, cyan = false,
}: FieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const lastCommitted = useRef(String(value))

  useEffect(() => {
    const el = inputRef.current
    if (!el || document.activeElement === el) return
    el.value = String(value)
    lastCommitted.current = String(value)
  }, [value])

  function commitFromInput() {
    const v = inputRef.current?.value ?? ''
    if (onCommit && v !== lastCommitted.current) {
      onCommit(v)
      lastCommitted.current = v
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    e.stopPropagation()
    const input = e.currentTarget

    if (isBackspaceKey(e)) {
      e.preventDefault()
      applyInputBackspace(input)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      commitFromInput()
      input.blur()
    }
  }

  return (
    <div className="space-y-0.5 mb-2">
      <label className="text-[9px] text-[var(--muted)] uppercase">{label}</label>
      <input
        ref={inputRef}
        type="text"
        defaultValue={String(value)}
        onBlur={commitFromInput}
        onKeyDown={handleKeyDown}
        className={`editor-input font-ui ${cyan ? 'text-[var(--accent)] font-semibold' : ''}`}
      />
    </div>
  )
}

export type NumberFieldProps = Readonly<{
  label: string
  value: number
  onCommit: (value: number) => void
  step?: number
}>

export function NumberField({
  label, value, onCommit, step,
}: NumberFieldProps) {
  return (
    <div>
      <label className="text-[9px] text-[var(--muted)] uppercase tracking-wide">{label}</label>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={e => onCommit(Number(e.target.value))}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (isBackspaceKey(e)) {
            e.preventDefault()
            applyInputBackspace(e.currentTarget)
          }
        }}
        className="editor-input"
        data-mono
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tiny shared parsers / math helpers used by multiple sections.
// ---------------------------------------------------------------------------

export function parseSceneDimension(value: string, fallback: number): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(8192, Math.max(64, n)) : fallback
}

export function parseGridSize(value: string, fallback: number): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(512, Math.max(4, n)) : fallback
}
