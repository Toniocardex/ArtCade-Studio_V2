// ---------------------------------------------------------------------------
// Compact icon button shared by Logic Board rule/action toolbars.
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react'

export default function LogicIconButton({
  title,
  ariaLabel,
  onClick,
  active,
  danger,
  children,
}: {
  title: string
  ariaLabel: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`w-7 h-7 rounded border flex items-center justify-center text-xs shrink-0 ${
        danger
          ? 'border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--danger)]'
          : active
            ? 'border-[var(--accent)] text-[var(--accent)]'
            : 'border-[var(--border-2)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent-bd)]'
      }`}
    >
      {children}
    </button>
  )
}
