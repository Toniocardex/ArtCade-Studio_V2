// ---------------------------------------------------------------------------
// Vertical section shell for rule editor (When / Also require… / Then)
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react'

export type LogicBlockTone = 'neutral' | 'when' | 'if' | 'then'

const TONE_BORDER_CLASS: Record<LogicBlockTone, string> = {
  neutral: 'border-l-[var(--border-2)]',
  when: 'border-l-[var(--accent-2)]',
  if: 'border-l-[var(--warn)]',
  then: 'border-l-[var(--accent)]',
}

export type LogicBlockProps = Readonly<{
  title: string
  children: ReactNode
  optional?: boolean
  icon?: ReactNode
  action?: ReactNode
  tone?: LogicBlockTone
}>

export function LogicBlock({
  title,
  children,
  optional,
  icon,
  action,
  tone = 'neutral',
}: LogicBlockProps) {
  const toneClass = TONE_BORDER_CLASS[tone]

  return (
    <div className={`border-l-2 ${toneClass} pl-3`}>
      <div className="flex items-center gap-2 pb-2">
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
      <div className="space-y-2">{children}</div>
    </div>
  )
}
