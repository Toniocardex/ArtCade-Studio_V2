import type { ReactNode } from 'react'
import { editorCtaFilled } from '../ui/editor-ui-classes'

const base =
  'inline-flex items-center justify-center gap-1 rounded border font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none'

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

/** Shared icon button for explorer toolbars and hover-revealed row actions. */
export function ExplorerRowAction({
  title,
  onClick,
  disabled,
  tone = 'default',
  children,
}: Readonly<{
  title: string
  onClick: (ev: React.MouseEvent) => void
  disabled?: boolean
  tone?: 'default' | 'accent' | 'danger' | 'onSelected'
  children: ReactNode
}>) {
  const toneClass =
    tone === 'accent'
      ? 'text-[var(--accent)] hover:bg-[rgb(var(--accent-rgb)/0.14)] hover:border-[rgb(var(--accent-rgb)/0.35)]'
      : tone === 'danger'
        ? 'text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[rgb(var(--danger-rgb)/0.12)] hover:border-[rgb(var(--danger-rgb)/0.35)]'
        : tone === 'onSelected'
          ? 'text-[var(--bg)] hover:bg-[rgb(var(--bg-rgb)/0.22)] hover:border-[rgb(var(--bg-rgb)/0.35)]'
          : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] hover:border-[var(--border)]'

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-5 h-5 rounded border border-transparent
                 transition-colors disabled:opacity-30 disabled:pointer-events-none flex-shrink-0 ${toneClass}`}
    >
      {children}
    </button>
  )
}
