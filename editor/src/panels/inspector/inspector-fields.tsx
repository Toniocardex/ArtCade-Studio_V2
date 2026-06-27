// ---------------------------------------------------------------------------
// inspector-fields — collapsible section + text/number field primitives
// ---------------------------------------------------------------------------
//
// Extracted from InspectorPanel.tsx during Phase 3 of the technical-debt
// split (see docs/TECHNICAL_DEBT_REVIEW.md). Every Inspector section uses the
// same chrome (caret + bordered title) and the same text/number inputs;
// keeping them here avoids re-implementing keyboard handling per section.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import { applyInputBackspace, isBackspaceKey } from '../../utils/keyboard'
export { snapToGridValue } from '../../utils/entity-position'

type TooltipPos = { top: number; right: number } | { top: number; left: number }

/**
 * "?" affordance with a portal tooltip. Defaults to opening leftward (right-side
 * inspector); pass placement="right" in left-docked panels so the tooltip opens
 * into the canvas instead of clipping off the left edge.
 */
export function HelpTooltip({
  text,
  placement = 'left',
}: Readonly<{ text: string; placement?: 'left' | 'right' }>) {
  const [pos, setPos] = useState<TooltipPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const show = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const top = r.top + r.height / 2
    setPos(
      placement === 'right'
        ? { top, left: r.right + 8 }
        : { top, right: window.innerWidth - r.left + 8 },
    )
  }, [placement])

  const hide = useCallback(() => setPos(null), [])

  return (
    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        tabIndex={-1}
        aria-label="More information"
        onMouseEnter={show}
        onMouseLeave={hide}
        className="w-3.5 h-3.5 rounded-full text-[8px] font-bold leading-none
                   flex items-center justify-center
                   border border-[var(--border)] text-[var(--muted)]
                   hover:border-[var(--accent)] hover:text-[var(--accent)]
                   transition-colors"
      >
        ?
      </button>
      {pos && createPortal(
        <div
          style={{ position: 'fixed', ...pos, transform: 'translateY(-50%)', zIndex: 9999 }}
          className="w-56 p-2 rounded pointer-events-none
                     bg-[var(--panel)] border border-[var(--border-2)] shadow-lg
                     text-[10px] text-[var(--muted)] leading-snug
                     normal-case tracking-normal font-normal"
        >
          {text}
        </div>,
        document.body,
      )}
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
    <div className="mt-5 first:mt-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between text-[10px] text-[var(--text)]
                     hover:text-[var(--accent)] font-bold uppercase tracking-widest transition-colors"
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="w-[3px] h-[11px] rounded-sm bg-[var(--accent)] shrink-0"
            />
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
  tooltip?: string
}>

export function Field({
  label, value, onCommit, cyan = false, tooltip,
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
      <div className="flex items-center gap-1">
        <label className="text-[11px] text-[var(--muted)]">{label}</label>
        {tooltip && <HelpTooltip text={tooltip} />}
      </div>
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
      <label className="text-[11px] text-[var(--muted)]">{label}</label>
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

export type InspectorRowProps = Readonly<{
  label: string
  tooltip?: string
  /** Muted suffix rendered after the control (e.g. units like "px/m"). */
  unit?: string
  children: ReactNode
}>

/**
 * Label-left / control-right field row — the single field rhythm shared across
 * inspector sections. Replaces ad-hoc inline layouts so World, Canvas, and
 * future sections line up identically.
 */
export function InspectorRow({
  label, tooltip, unit, children,
}: InspectorRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <span className="text-[11px] text-[var(--muted)] flex items-center gap-1">
        {label}
        {tooltip && <HelpTooltip text={tooltip} />}
      </span>
      <div className="flex items-center gap-1.5">
        {children}
        {unit && <span className="text-[10px] text-[var(--muted)] shrink-0">{unit}</span>}
      </div>
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
