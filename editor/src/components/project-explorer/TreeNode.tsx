import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'

export type TreeFolderProps = Readonly<{
  label: string
  count: number
  depth?: number
  open: boolean
  onToggle: () => void
  accent?: boolean
  children?: ReactNode
}>

export function TreeFolder({
  label,
  count,
  depth = 0,
  open,
  onToggle,
  accent = false,
  children,
}: TreeFolderProps) {
  const pad = 8 + depth * 12
  const FolderIcon = open ? FolderOpen : Folder

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1 py-1 text-xs text-[var(--text)] hover:text-[var(--accent)]
                   hover:bg-[rgb(var(--border-rgb)/0.25)] rounded transition-colors"
        style={{ paddingLeft: pad }}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown size={10} className="text-[var(--muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-[var(--muted)] flex-shrink-0" />
        )}
        <FolderIcon
          size={12}
          className={`flex-shrink-0 ${accent ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
        />
        <span className="truncate">{label}</span>
        <span className="text-[10px] text-[var(--muted)] ml-auto pr-2 tabular-nums">({count})</span>
      </button>
      {open && children ? (
        <div className="border-l border-[var(--border)] ml-3">{children}</div>
      ) : null}
    </div>
  )
}

export type TreeLeafProps = Readonly<{
  label: string
  depth?: number
  selected?: boolean
  muted?: boolean
  icon?: ReactNode
  trailing?: ReactNode
  onClick: () => void
  onDoubleClick?: () => void
  title?: string
}>

export function TreeLeaf({
  label,
  depth = 0,
  selected = false,
  muted = false,
  icon,
  trailing,
  onClick,
  onDoubleClick,
  title,
}: TreeLeafProps) {
  const pad = 12 + depth * 12

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={title}
      className={`w-full flex items-center gap-1.5 py-1 pr-2 rounded text-xs text-left transition-colors ${
        selected
          ? 'bg-[var(--accent)] text-[var(--bg)] font-semibold'
          : muted
            ? 'text-[var(--muted)] opacity-60 hover:opacity-100 hover:bg-[rgb(var(--border-rgb)/0.35)]'
            : 'text-[var(--text)] hover:bg-[rgb(var(--border-rgb)/0.35)]'
      }`}
      style={{ paddingLeft: pad }}
    >
      {icon}
      <span className="truncate flex-1 min-w-0">{label}</span>
      {trailing}
    </button>
  )
}
