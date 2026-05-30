import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export type SectionCollapseProps = Readonly<{
  title: string
  defaultOpen?: boolean
  children: ReactNode
}>

export function SectionCollapse({ title, defaultOpen = true, children }: SectionCollapseProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-[var(--outline-subtle)]">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--outline-faint)] transition-colors duration-100"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronDown
          size={14}
          className={`text-[var(--muted)] transition-transform duration-100 ${open ? '' : '-rotate-90'}`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--primary)]">
          {title}
        </span>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  )
}
