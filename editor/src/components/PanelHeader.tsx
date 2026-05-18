import type { ReactNode } from 'react'

interface PanelHeaderProps {
  title:     string
  children?: ReactNode
}

/** Panel header — bottom border, muted ALL-CAPS label */
export default function PanelHeader({ title, children }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2
                    border-b border-[var(--border)] select-none flex-shrink-0">
      <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">
        {title}
      </span>
      {children && (
        <div className="flex items-center gap-1">{children}</div>
      )}
    </div>
  )
}
