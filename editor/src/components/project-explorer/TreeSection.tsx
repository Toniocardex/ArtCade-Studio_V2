import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export type TreeSectionProps = Readonly<{
  title: string
  open: boolean
  onToggle: () => void
  actions?: ReactNode
  children: ReactNode
  hidden?: boolean
}>

export function TreeSection({
  title,
  open,
  onToggle,
  actions,
  children,
  hidden = false,
}: TreeSectionProps) {
  if (hidden) return null

  return (
    <section className="border-b border-[var(--border)]">
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-[var(--panel-2)]">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown size={12} className="text-[var(--muted)] flex-shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-[var(--muted)] flex-shrink-0" />
          )}
          <span className="text-[9px] text-[var(--muted)] uppercase font-bold tracking-widest truncate">
            {title}
          </span>
        </button>
        {actions}
      </div>
      {open ? <div className="px-1 py-1">{children}</div> : null}
    </section>
  )
}
