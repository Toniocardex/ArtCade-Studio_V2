import { useRef, useState, type ReactNode } from 'react'
import { FolderPlus, FileDown, Search, ImagePlus, Music, Type, Trash2 } from 'lucide-react'

export type AssetToolbarProps = Readonly<{
  disabled: boolean
  canRemove: boolean
  onNewFolder: () => void
  onImportImage: () => void
  onImportAudio: () => void
  onImportFont: () => void
  onFocusAssets: () => void
  onRemove: () => void
}>

function ToolbarBtn({
  label,
  icon,
  onClick,
  disabled,
  title,
}: Readonly<{
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 p-1.5 rounded
                 border border-[var(--border)] bg-[var(--panel-2)] text-[var(--muted)]
                 hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-40 transition-colors"
    >
      <span className="text-[var(--muted)]">{icon}</span>
      <span className="text-[9px] leading-tight text-center">{label}</span>
    </button>
  )
}

export function AssetToolbar({
  disabled,
  canRemove,
  onNewFolder,
  onImportImage,
  onImportAudio,
  onImportFont,
  onFocusAssets,
  onRemove,
}: AssetToolbarProps) {
  const [importOpen, setImportOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  return (
    <div className="px-2 py-2 flex gap-1 border-b border-[var(--border)] bg-[var(--panel-3)] relative">
      <ToolbarBtn
        label="New Folder"
        icon={<FolderPlus size={18} />}
        onClick={onNewFolder}
        disabled
        title="Custom folders — coming soon"
      />
      <div className="flex-1 relative" ref={menuRef}>
        <ToolbarBtn
          label="Import File"
          icon={<FileDown size={18} />}
          onClick={() => setImportOpen((v) => !v)}
          disabled={disabled}
          title="Import image, audio, or font"
        />
        {importOpen && !disabled ? (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-20 rounded border border-[var(--border)]
                       bg-[var(--panel)] shadow-lg py-1 flex flex-col"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex items-center gap-2 px-2 py-1.5 text-[10px] hover:bg-[var(--panel-2)] text-left"
              onClick={() => { setImportOpen(false); onImportImage() }}
            >
              <ImagePlus size={12} /> Import image
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex items-center gap-2 px-2 py-1.5 text-[10px] hover:bg-[var(--panel-2)] text-left"
              onClick={() => { setImportOpen(false); onImportAudio() }}
            >
              <Music size={12} /> Import audio
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex items-center gap-2 px-2 py-1.5 text-[10px] hover:bg-[var(--panel-2)] text-left"
              onClick={() => { setImportOpen(false); onImportFont() }}
            >
              <Type size={12} /> Import font
            </button>
          </div>
        ) : null}
      </div>
      <ToolbarBtn
        label="Asset Browser"
        icon={<Search size={18} />}
        onClick={onFocusAssets}
        title="Expand all asset folders"
      />
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          title="Remove selected asset (Delete)"
          className="flex items-center justify-center p-1.5 rounded border border-[var(--border)]
                     text-[var(--danger)] hover:bg-[var(--panel-2)]"
        >
          <Trash2 size={16} />
        </button>
      ) : null}
    </div>
  )
}
