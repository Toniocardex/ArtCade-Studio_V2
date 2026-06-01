import type { ReactNode } from 'react'
import type { RefObject } from 'react'
import { ToolbarDropdown } from './ToolbarDropdown'

export interface FileMenuItem {
  label: string
  icon: ReactNode
  shortcut: string
  action: () => void
  divider?: boolean
}

export type FileMenuProps = Readonly<{
  items: FileMenuItem[]
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  align?: 'left' | 'right'
}>

export function FileMenuContent({ items }: { items: FileMenuItem[] }) {
  return (
    <>
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && i > 0 && (
            <div className="my-1 border-t border-[var(--border)]" />
          )}
          <button
            type="button"
            role="menuitem"
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
    </>
  )
}

export function FileMenu({ items, open, anchorRef, onClose, align = 'left' }: FileMenuProps) {
  return (
    <ToolbarDropdown open={open} anchorRef={anchorRef} align={align} onClose={onClose}>
      <FileMenuContent items={items} />
    </ToolbarDropdown>
  )
}
