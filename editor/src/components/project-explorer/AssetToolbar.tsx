import { useRef, useState, type ReactNode } from 'react'
import { ChevronsDownUp, ChevronsUpDown, FolderPlus, ImagePlus, Grid3x3, Music, Type, Trash2 } from 'lucide-react'
import { ToolbarDropdown } from '../menu-bar/ToolbarDropdown'
import {
  ASSET_VIRTUAL_FOLDER_CATEGORIES,
  ASSET_VIRTUAL_FOLDER_CATEGORY_LABELS,
  type AssetVirtualFolderCategory,
} from '../../utils/asset-virtual-folders'

export type AssetToolbarProps = Readonly<{
  disabled: boolean
  canRemove: boolean
  onNewFolder: (category: AssetVirtualFolderCategory) => void
  onImportImage: () => void
  onImportTileset: () => void
  onImportAudio: () => void
  onImportFont: () => void
  allAssetFoldersExpanded: boolean
  onToggleAssetFoldersExpand: () => void
  onRemove: () => void
}>

function IconBtn({
  icon,
  onClick,
  disabled,
  title,
  accent = false,
  danger = false,
}: Readonly<{
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  title: string
  accent?: boolean
  danger?: boolean
}>) {
  let tone = 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)]'
  if (accent) tone = 'text-[var(--accent)] hover:bg-[var(--accent-bg)]'
  if (danger) tone = 'text-[var(--danger)] hover:bg-[var(--panel-2)]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex items-center justify-center w-7 h-7 rounded border border-transparent
                 hover:border-[var(--border)] disabled:opacity-40 transition-colors ${tone}`}
    >
      {icon}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-[var(--border)] mx-0.5" />
}

/** Compact single-row asset actions: folder ops | import (image/tileset/audio/font) | remove. */
export function AssetToolbar({
  disabled,
  canRemove,
  onNewFolder,
  onImportImage,
  onImportTileset,
  onImportAudio,
  onImportFont,
  allAssetFoldersExpanded,
  onToggleAssetFoldersExpand,
  onRemove,
}: AssetToolbarProps) {
  const folderBtnRef = useRef<HTMLButtonElement>(null)
  const [folderMenuOpen, setFolderMenuOpen] = useState(false)

  const closeFolderMenu = () => setFolderMenuOpen(false)

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[var(--border)] bg-[var(--panel-3)]">
      <IconBtn
        icon={
          allAssetFoldersExpanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />
        }
        onClick={onToggleAssetFoldersExpand}
        title={
          allAssetFoldersExpanded
            ? 'Collapse all asset folders'
            : 'Expand all asset folders'
        }
      />
      <button
        ref={folderBtnRef}
        type="button"
        onClick={() => setFolderMenuOpen((open) => !open)}
        disabled={disabled}
        title="New folder…"
        aria-label="New folder…"
        className="flex items-center justify-center w-7 h-7 rounded border border-transparent
                   text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)]
                   hover:border-[var(--border)] disabled:opacity-40 transition-colors"
      >
        <FolderPlus size={14} />
      </button>
      <ToolbarDropdown open={folderMenuOpen} anchorRef={folderBtnRef} onClose={closeFolderMenu}>
        {ASSET_VIRTUAL_FOLDER_CATEGORIES.filter((category) => category !== 'images').map((category) => (
          <button
            key={category}
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text)]
                       hover:bg-[rgb(var(--border-rgb)/0.35)] transition-colors"
            onClick={() => {
              closeFolderMenu()
              onNewFolder(category)
            }}
          >
            {ASSET_VIRTUAL_FOLDER_CATEGORY_LABELS[category]}
          </button>
        ))}
      </ToolbarDropdown>
      <Divider />
      <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--muted)] px-1 select-none">
        Import
      </span>
      <IconBtn
        icon={<ImagePlus size={14} />}
        onClick={onImportImage}
        disabled={disabled}
        title="Import image (PNG, JPEG, GIF)"
        accent
      />
      <IconBtn
        icon={<Grid3x3 size={14} />}
        onClick={onImportTileset}
        disabled={disabled}
        title="Import tileset (PNG, JPEG, GIF)"
      />
      <IconBtn
        icon={<Music size={14} />}
        onClick={onImportAudio}
        disabled={disabled}
        title="Import audio (OGG, WAV, MP3)"
      />
      <IconBtn
        icon={<Type size={14} />}
        onClick={onImportFont}
        disabled={disabled}
        title="Import font (TTF, OTF)"
      />
      {canRemove ? (
        <>
          <div className="flex-1" />
          <IconBtn
            icon={<Trash2 size={14} />}
            onClick={onRemove}
            title="Remove selected asset (Delete)"
            danger
          />
        </>
      ) : null}
    </div>
  )
}
