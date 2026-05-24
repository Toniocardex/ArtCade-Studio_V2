// ---------------------------------------------------------------------------
// Vertical section shell for rule editor (When / Only if / Then)
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react'

export function LogicBlock({
  title,
  hint,
  children,
  optional,
  icon,
  action,
  tone = 'neutral',
}: {
  title: string
  hint?: string
  children: ReactNode
  optional?: boolean
  icon?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'when' | 'if' | 'then'
}) {
  const toneClass =
    tone === 'when'
      ? 'border-l-[var(--accent-2)]'
      : tone === 'if'
        ? 'border-l-[var(--warn)]'
        : tone === 'then'
          ? 'border-l-[var(--accent)]'
          : 'border-l-[var(--border-2)]'

  return (
    <div className={`rounded border border-[var(--border)] border-l-2 ${toneClass} bg-[var(--panel)] overflow-hidden`}>
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--panel-3)]">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="shrink-0 text-[var(--accent)]" aria-hidden="true">
              {icon}
            </span>
          )}
          <span className="text-xs font-semibold text-[var(--text)]">{title}</span>
          {optional && (
            <span className="text-[10px] text-[var(--muted)]">(optional)</span>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </div>
        {hint && (
          <p className="text-[10px] text-[var(--muted)] mt-0.5 leading-snug">{hint}</p>
        )}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  )
}
