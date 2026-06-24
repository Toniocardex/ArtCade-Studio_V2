import { useRef, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { spritesheetStudioTriggerProps } from '../../panels/spritesheet-studio/openSpritesheetStudio'
import { editorRowSelected } from '../ui/editor-ui-classes'
import { useAssetTreeDropHighlight } from './asset-tree-dnd'

export type TreeFolderProps = Readonly<{
  label: string
  count: number
  depth?: number
  open: boolean
  onToggle: () => void
  onDoubleClick?: () => void
  onContextMenu?: (ev: React.MouseEvent) => void
  /** Folder row id for delegated DnD (`data-asset-folder-id` on the header button). */
  assetFolderId?: string
  accent?: boolean
  children?: ReactNode
}>

export function TreeFolder({
  label,
  count,
  depth = 0,
  open,
  onToggle,
  onDoubleClick,
  onContextMenu,
  assetFolderId,
  accent = false,
  children,
}: TreeFolderProps) {
  const pad = 8 + depth * 12
  const FolderIcon = open ? FolderOpen : Folder
  const dropHighlight = useAssetTreeDropHighlight(assetFolderId)

  return (
    <div onContextMenu={onContextMenu}>
      <button
        type="button"
        data-asset-folder-id={assetFolderId}
        onClick={onToggle}
        onDoubleClick={onDoubleClick}
        className={`w-full flex items-center gap-1 py-1 text-xs text-[var(--text)] hover:text-[var(--accent)]
                   hover:bg-[rgb(var(--border-rgb)/0.25)] rounded transition-colors
                   ${dropHighlight ? 'ring-1 ring-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.12)]' : ''}`}
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
  /** Icon buttons shown on the right (same row); use stopPropagation inside handlers. */
  actions?: ReactNode
  onClick: (ev: MouseEvent) => void
  onDoubleClick?: () => void
  onContextMenu?: (ev: React.MouseEvent) => void
  title?: string
  draggable?: boolean
  onDragStart?: (ev: DragEvent) => void
  /** Image asset rows: allow Enter in explorer to open Spritesheet Studio when this leaf is focused. */
  spritesheetStudioTrigger?: boolean
}>

export type ExplorerRowProps = Readonly<{
  depth?: number
  icon?: ReactNode
  label: string
  selected?: boolean
  muted?: boolean
  trailing?: ReactNode
  actions?: ReactNode
  onClick: (ev: MouseEvent) => void
  onDoubleClick?: () => void
  onContextMenu?: (ev: React.MouseEvent) => void
  title?: string
  spritesheetStudioTrigger?: boolean
}>

const leafRowClass = (selected: boolean, muted: boolean) =>
  selected
    ? editorRowSelected
    : muted
      ? 'text-[var(--muted)] opacity-60 hover:opacity-100 hover:bg-[rgb(var(--border-rgb)/0.35)]'
      : 'text-[var(--text)] hover:bg-[rgb(var(--border-rgb)/0.35)]'

function leafDragClass(draggable: boolean) {
  return draggable ? 'asset-tree-leaf--draggable cursor-grab active:cursor-grabbing' : ''
}

function leafActivateFromKey(e: KeyboardEvent, onClick: (ev: MouseEvent) => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    onClick(e as unknown as MouseEvent)
  }
}

function TreeLeafActionRail({
  selected,
  children,
}: Readonly<{ selected: boolean; children: ReactNode }>) {
  return (
    <div
      className={`flex items-center gap-0.5 pr-1 flex-shrink-0 transition-opacity ${
        selected
          ? 'opacity-100'
          : 'opacity-0 group-hover/explorer-row:opacity-100 group-focus-within/explorer-row:opacity-100'
      }`}
    >
      {children}
    </div>
  )
}

export function ExplorerRow({
  label,
  depth = 0,
  selected = false,
  muted = false,
  icon,
  trailing,
  actions,
  onClick,
  onDoubleClick,
  onContextMenu,
  title,
  spritesheetStudioTrigger = false,
}: ExplorerRowProps) {
  const pad = 12 + depth * 12
  const studioTrigger = spritesheetStudioTrigger ? spritesheetStudioTriggerProps : undefined
  const rowClass = `rounded text-xs transition-colors ${leafRowClass(selected, muted)}`
  const onKeyDown = (e: KeyboardEvent) => leafActivateFromKey(e, onClick)
  const row = (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      title={title}
      {...studioTrigger}
      className={`w-full flex items-center gap-1.5 py-1 pr-2 text-left ${rowClass}`}
      style={{ paddingLeft: pad }}
    >
      <span className="flex-shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="truncate flex-1 min-w-0">{label}</span>
      {trailing}
    </div>
  )

  if (!actions) return row

  return (
    <div className="group/explorer-row flex items-center gap-0.5 w-full min-w-0">
      <div className="flex flex-1 min-w-0">{row}</div>
      <TreeLeafActionRail selected={selected}>{actions}</TreeLeafActionRail>
    </div>
  )
}

/**
 * Draggable asset row: one draggable div; children use pointer-events-none so
 * WebView2 hits the draggable element (required when Tauri dragDropEnabled is false).
 */
function DraggableAssetTreeLeaf({
  rowClass,
  pad,
  title,
  studioTrigger,
  onClick,
  onDoubleClick,
  onContextMenu,
  onKeyDown,
  onDragStart,
  icon,
  label,
  trailing,
}: Readonly<{
  rowClass: string
  pad: number
  title?: string
  studioTrigger?: typeof spritesheetStudioTriggerProps
  onClick: (ev: MouseEvent) => void
  onDoubleClick?: () => void
  onContextMenu?: (ev: React.MouseEvent) => void
  onKeyDown: (ev: KeyboardEvent) => void
  onDragStart?: (ev: DragEvent) => void
  icon?: ReactNode
  label: string
  trailing?: ReactNode
}>) {
  const didDragRef = useRef(false)

  return (
    <div
      draggable
      onDragStart={(event) => {
        didDragRef.current = true
        onDragStart?.(event)
      }}
      onClick={(event) => {
        if (didDragRef.current) {
          didDragRef.current = false
          return
        }
        onClick(event)
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      tabIndex={0}
      title={title}
      {...studioTrigger}
      className={`w-full flex items-center gap-1.5 py-1 pr-2 text-left ${rowClass}`}
      style={{ paddingLeft: pad }}
    >
      <span className="flex flex-1 items-center gap-1.5 min-w-0 pointer-events-none">
        <span className="flex-shrink-0" aria-hidden>
          {icon}
        </span>
        <span className="truncate flex-1 min-w-0">{label}</span>
        {trailing}
      </span>
    </div>
  )
}

export function TreeLeaf({
  label,
  depth = 0,
  selected = false,
  muted = false,
  icon,
  trailing,
  actions,
  onClick,
  onDoubleClick,
  onContextMenu,
  title,
  draggable = false,
  onDragStart,
  spritesheetStudioTrigger = false,
}: TreeLeafProps) {
  const pad = 12 + depth * 12
  const studioTrigger = spritesheetStudioTrigger ? spritesheetStudioTriggerProps : undefined
  const rowClass = `rounded text-xs transition-colors ${leafRowClass(selected, muted)} ${leafDragClass(draggable)}`
  const onKeyDown = (e: KeyboardEvent) => leafActivateFromKey(e, onClick)

  if (draggable) {
    const dragLeaf = (
      <DraggableAssetTreeLeaf
        rowClass={rowClass}
        pad={pad}
        title={title}
        studioTrigger={studioTrigger}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
        onDragStart={onDragStart}
        icon={icon}
        label={label}
        trailing={trailing}
      />
    )

    if (actions) {
      return (
        <div className="group/explorer-row flex items-center gap-0.5 w-full min-w-0">
          <div className="flex flex-1 min-w-0">{dragLeaf}</div>
          <TreeLeafActionRail selected={selected}>{actions}</TreeLeafActionRail>
        </div>
      )
    }

    return dragLeaf
  }

  return (
    <ExplorerRow
      label={label}
      depth={depth}
      selected={selected}
      muted={muted}
      icon={icon}
      trailing={trailing}
      actions={actions}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      title={title}
      spritesheetStudioTrigger={spritesheetStudioTrigger}
    />
  )
}
