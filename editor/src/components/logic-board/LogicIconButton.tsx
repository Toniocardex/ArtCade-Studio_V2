// ---------------------------------------------------------------------------
// Compact icon button shared by Logic Board rule/action toolbars.
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react'

const ICON_BTN_BASE =
  'w-7 h-7 rounded border flex items-center justify-center text-xs shrink-0'

function logicIconButtonClass(active?: boolean, danger?: boolean): string {
  if (danger) {
    return `${ICON_BTN_BASE} border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--danger)]`
  }
  if (active) {
    return `${ICON_BTN_BASE} border-[var(--accent)] text-[var(--accent)]`
  }
  return `${ICON_BTN_BASE} border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent-bd)]`
}

export type LogicIconButtonProps = Readonly<{
  title: string
  ariaLabel: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  disabled?: boolean
  ariaExpanded?: boolean
  children: ReactNode
}>

export default function LogicIconButton({
  title,
  ariaLabel,
  onClick,
  active,
  danger,
  disabled,
  ariaExpanded,
  children,
}: LogicIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      className={`${logicIconButtonClass(active, danger)}${
        disabled ? ' opacity-40 cursor-not-allowed pointer-events-none' : ''
      }`}
    >
      {children}
    </button>
  )
}
