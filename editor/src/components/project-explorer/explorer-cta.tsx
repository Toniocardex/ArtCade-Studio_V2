import type { ReactNode } from 'react'
import { editorCtaFilled } from '../ui/editor-ui-classes'

const base =
  'inline-flex items-center justify-center gap-1 rounded border font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none'

export function ExplorerIconBtn({
  title,
  onClick,
  disabled,
  tone = 'default',
  children,
}: Readonly<{
  title: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'accent' | 'danger'
  children: ReactNode
}>) {
  const toneClass =
    tone === 'accent'
      ? editorCtaFilled
      : tone === 'danger'
        ? 'border-[var(--border-2)] bg-[var(--bg)] text-[var(--primary-soft)] hover:border-[var(--danger)] hover:text-[var(--danger)] hover:bg-[rgb(var(--danger-rgb)/0.12)]'
        : 'border-[var(--border-2)] bg-[var(--bg)] text-[var(--primary-soft)] hover:text-[var(--primary)] hover:border-[var(--border)] hover:bg-[var(--panel-2)]'

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} p-1.5 min-w-[1.75rem] min-h-[1.75rem] ${toneClass}`}
    >
      {children}
    </button>
  )
}

export function ExplorerLabelCta({
  label,
  title,
  onClick,
  disabled,
  tone = 'primary',
  icon,
}: Readonly<{
  label: string
  title?: string
  onClick: () => void
  disabled?: boolean
  tone?: 'primary' | 'default'
  icon?: ReactNode
}>) {
  const toneClass =
    tone === 'primary'
      ? `${editorCtaFilled} px-2 py-1 text-[10px]`
      : 'border-[var(--border-2)] bg-[var(--surface-2)] text-[var(--primary)] hover:bg-[var(--surface-hover)] px-2 py-1 text-[10px]'

  return (
    <button
      type="button"
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${toneClass}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function ExplorerActionBar({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--panel-3)]">
      {children}
    </div>
  )
}

/** Inline row actions on a selected tree leaf (accent background). */
export function ExplorerLeafActionBtn({
  title,
  onClick,
  children,
}: Readonly<{
  title: string
  onClick: (ev: React.MouseEvent) => void
  children: ReactNode
}>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="p-1 rounded border border-transparent hover:border-[rgb(var(--bg-rgb)/0.35)]
                 hover:bg-[rgb(var(--bg-rgb)/0.2)] text-[var(--bg)] flex-shrink-0"
    >
      {children}
    </button>
  )
}
