import type { ReactNode } from 'react'
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Grid3x3,
  ImagePlus,
  Music,
  Trash2,
  Type,
} from 'lucide-react'

export type AssetToolbarProps = Readonly<{
  disabled: boolean
  canRemove: boolean
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

/** Compact single-row asset actions: expand/collapse | import | remove. */
export function AssetToolbar({
  disabled,
  canRemove,
  onImportImage,
  onImportTileset,
  onImportAudio,
  onImportFont,
  allAssetFoldersExpanded,
  onToggleAssetFoldersExpand,
  onRemove,
}: AssetToolbarProps) {
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
