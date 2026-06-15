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

export function HelpTooltip({ text }: Readonly<{ text: string }>) {
  return (
    <div
      className="relative group shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="More information"
        className="w-3.5 h-3.5 rounded-full text-[8px] font-bold leading-none
                   flex items-center justify-center
                   border border-[var(--border)] text-[var(--muted)]
                   hover:border-[var(--accent)] hover:text-[var(--accent)]
                   transition-colors"
      >
        ?
      </button>
      <div
        className="absolute right-0 bottom-full mb-2 z-[200] w-56 p-2 rounded
                   bg-[var(--panel)] border border-[var(--border-2)]
                   text-[10px] text-[var(--muted)] leading-snug
                   normal-case tracking-normal font-normal
                   opacity-0 group-hover:opacity-100 pointer-events-none
                   transition-opacity duration-100"
      >
        {text}
      </div>
    </div>
  )
}

export type InspectorSectionBadge = {
  text: string
  color: 'green' | 'blue' | 'amber' | 'muted'
}

export type InspectorSectionProps = Readonly<{
  label: string
  labelBadge?: InspectorSectionBadge
  tooltip?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}>

const BADGE_CLASS: Record<InspectorSectionBadge['color'], string> = {
  green: 'bg-[#1a3a1a] text-[#4caf50] border border-[#2a5a2a]',
  blue:  'bg-[#1a2a3a] text-[#64b5f6] border border-[#1e3a5f]',
  amber: 'bg-[#3a2a0a] text-[#ffb74d] border border-[#5a3a0a]',
  muted: 'bg-[var(--panel-3)] text-[var(--muted)] border border-[var(--border)]',
}

export function InspectorSection({
  label,
  labelBadge,
  tooltip,
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
      <div className="flex items-center gap-1.5 border-b border-[var(--border)] pb-1 mb-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between text-[10px] text-[var(--muted)]
                     hover:text-[var(--text)] font-bold uppercase tracking-widest transition-colors"
        >
          <span className="flex items-center gap-2">
            {label}
            {labelBadge && (
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded normal-case tracking-wide ${BADGE_CLASS[labelBadge.color]}`}>
                {labelBadge.text}
              </span>
            )}
          </span>
          <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        {tooltip && <HelpTooltip text={tooltip} />}
      </div>
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
        className={`editor-input font-ui ${cyan ? 'text-[var(--text)] font-semibold' : ''}`}
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
