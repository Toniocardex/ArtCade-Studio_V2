import type { ReactNode } from 'react'
import { FolderPlus, Search, ImagePlus, Music, Type, Trash2 } from 'lucide-react'

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
  className = '',
}: Readonly<{
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
  className?: string
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`flex flex-col items-center justify-center gap-1 min-h-[3.25rem] px-2 py-2 rounded
                 border border-[var(--border)] bg-[var(--panel-2)] text-[var(--muted)]
                 hover:bg-[var(--border)] hover:text-[var(--text)] disabled:opacity-40 transition-colors
                 ${className}`}
    >
      <span className="text-[var(--muted)]">{icon}</span>
      <span className="text-[10px] leading-tight text-center font-medium">{label}</span>
    </button>
  )
}

function ImportBtn({
  label,
  hint,
  icon,
  onClick,
  disabled,
  accent = false,
}: Readonly<{
  label: string
  hint: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  accent?: boolean
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`flex flex-col items-center justify-center gap-1 min-h-[3.5rem] px-1.5 py-2 rounded
                 border text-center transition-colors disabled:opacity-40 ${
        accent
          ? 'border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]'
          : 'border-[var(--border-2)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--panel-2)] hover:border-[var(--border)]'
      }`}
    >
      <span className={accent ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}>{icon}</span>
      <span className="text-[10px] font-semibold leading-tight">{label}</span>
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
  return (
    <div className="px-2 py-2 border-b border-[var(--border)] bg-[var(--panel-3)] space-y-2">
      <div className="flex gap-1.5 items-stretch">
        <ToolbarBtn
          label="New Folder"
          icon={<FolderPlus size={18} />}
          onClick={onNewFolder}
          disabled={disabled}
          title="Create a virtual folder under Images"
          className="flex-1 min-w-0"
        />
        <ToolbarBtn
          label="Expand all"
          icon={<Search size={18} />}
          onClick={onFocusAssets}
          title="Expand all asset category folders"
          className="flex-1 min-w-0"
        />
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            title="Remove selected asset (Delete)"
            className="flex items-center justify-center min-h-[3.25rem] min-w-[2.75rem] px-2 rounded
                       border border-[var(--border)] text-[var(--danger)]
                       hover:bg-[var(--panel-2)] hover:border-[var(--danger)]"
          >
            <Trash2 size={18} />
          </button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--muted)] px-0.5">
          Import
        </p>
        <div className="grid grid-cols-3 gap-1.5 w-full">
          <ImportBtn
            label="Image"
            hint="Import PNG, JPEG, or GIF"
            icon={<ImagePlus size={16} />}
            onClick={onImportImage}
            disabled={disabled}
            accent
          />
          <ImportBtn
            label="Audio"
            hint="Import OGG, WAV, or MP3"
            icon={<Music size={16} />}
            onClick={onImportAudio}
            disabled={disabled}
          />
          <ImportBtn
            label="Font"
            hint="Import TTF or OTF"
            icon={<Type size={16} />}
            onClick={onImportFont}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
