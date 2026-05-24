// ---------------------------------------------------------------------------
// Vertical section shell for rule editor (When / Only if / Then)
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react'

export function LogicBlock({
  title,
  hint,
  children,
  optional,
}: {
  title: string
  hint?: string
  children: ReactNode
  optional?: boolean
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--panel-3)]">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-[var(--text)]">{title}</span>
          {optional && (
            <span className="text-[10px] text-[var(--muted)]">(optional)</span>
          )}
        </div>
        {hint && (
          <p className="text-[10px] text-[var(--muted)] mt-0.5 leading-snug">{hint}</p>
        )}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  )
}
