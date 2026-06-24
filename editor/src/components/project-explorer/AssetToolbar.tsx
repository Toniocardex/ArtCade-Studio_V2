import type { ReactNode } from 'react'
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Film,
  Grid3x3,
  ImagePlus,
  Music,
  Trash2,
  Type,
} from 'lucide-react'
import { ExplorerRowAction } from './explorer-cta'

export type AssetToolbarProps = Readonly<{
  disabled: boolean
  canRemove: boolean
  onCreateAnimatedSprite: () => void
  onImportImage: () => void
  onImportTileset: () => void
  onImportAudio: () => void
  onImportFont: () => void
  allAssetFoldersExpanded: boolean
  onToggleAssetFoldersExpand: () => void
  onRemove: () => void
}>

function ToolbarAction({
  title,
  onClick,
  disabled,
  tone = 'default',
  children,
}: Readonly<{
  title: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'accent' | 'danger'
  children: ReactNode
}>) {
  return (
    <ExplorerRowAction
      title={title}
      disabled={disabled}
      tone={tone}
      onClick={(ev) => {
        ev.stopPropagation()
        // Call with no args: several handlers take an optional target/folder
        // parameter, and leaking the click event in as that argument breaks the
        // import (e.g. image usage becomes undefined and the asset vanishes).
        onClick()
      }}
    >
      {children}
    </ExplorerRowAction>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-[var(--border)] mx-0.5" />
}

/** Compact single-row asset actions: expand/collapse | import | remove. */
export function AssetToolbar({
  disabled,
  canRemove,
  onCreateAnimatedSprite,
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
      <ToolbarAction
        onClick={onToggleAssetFoldersExpand}
        title={
          allAssetFoldersExpanded
            ? 'Collapse all asset folders'
            : 'Expand all asset folders'
        }
      >
        {allAssetFoldersExpanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
      </ToolbarAction>
      <Divider />
      <ToolbarAction
        onClick={onCreateAnimatedSprite}
        disabled={disabled}
        title="Create animated sprite"
        tone="accent"
      >
        <Film size={14} />
      </ToolbarAction>
      <ToolbarAction
        onClick={onImportImage}
        disabled={disabled}
        title="Import image (PNG, JPEG, GIF)"
      >
        <ImagePlus size={14} />
      </ToolbarAction>
      <ToolbarAction
        onClick={onImportTileset}
        disabled={disabled}
        title="Import tileset (PNG, JPEG, GIF)"
      >
        <Grid3x3 size={14} />
      </ToolbarAction>
      <ToolbarAction
        onClick={onImportAudio}
        disabled={disabled}
        title="Import audio (OGG, WAV, MP3)"
      >
        <Music size={14} />
      </ToolbarAction>
      <ToolbarAction
        onClick={onImportFont}
        disabled={disabled}
        title="Import font (TTF, OTF)"
      >
        <Type size={14} />
      </ToolbarAction>
      {canRemove ? (
        <>
          <div className="flex-1" />
          <ToolbarAction
            onClick={onRemove}
            title="Remove selected asset (Delete)"
            tone="danger"
          >
            <Trash2 size={14} />
          </ToolbarAction>
        </>
      ) : null}
    </div>
  )
}
