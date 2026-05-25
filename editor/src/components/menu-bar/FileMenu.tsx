import type { ReactNode } from 'react'

export interface FileMenuItem {
  label: string
  icon: ReactNode
  shortcut: string
  action: () => void
  divider?: boolean
}

export function FileMenu({ items }: { items: FileMenuItem[] }) {
  return (
    <div
      className="absolute top-full left-0 mt-1 z-[999]
                    bg-[var(--panel)] border border-[var(--border-2)] rounded
                    min-w-[220px] py-1 select-none"
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && i > 0 && (
            <div className="my-1 border-t border-[var(--border)]" />
          )}
          <button
            onClick={item.action}
            className="w-full flex items-center gap-3 px-4 py-2
                       text-[11px] text-[var(--text)] hover:bg-[var(--panel-3)]
                       hover:text-[var(--text)] transition-colors text-left"
          >
            <span className="text-[var(--muted)] flex-shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            <span className="text-[rgb(var(--muted-rgb)/0.6)] font-mono text-[9px]">
              {item.shortcut}
            </span>
          </button>
        </div>
      ))}
    </div>
  )
}
