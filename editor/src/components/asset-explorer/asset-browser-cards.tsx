import { useEffect, useState } from 'react'
import type { ElementType, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Image, Music, Code, FileText, Grid3x3, Type } from 'lucide-react'
import { bytesToArrayBuffer, readProjectFileBytes } from '../../utils/asset-file-api'
import type { AudioAsset, ImageAsset, TilesetAsset } from '../../types'

export const CARD_SELECTED =
  'border-[var(--accent)] ring-1 ring-[rgb(var(--accent-rgb)/0.35)]'
export const CARD_IDLE =
  'border-[var(--border)] hover:border-[rgb(var(--accent-rgb)/0.5)]'

export const CARD_BTN =
  'flex flex-col items-center gap-2 p-2 rounded border cursor-pointer transition-colors group bg-[var(--bg)] text-left w-full'

const ICON_MAP: Record<string, ElementType> = {
  IMAGES: Image,
  AUDIO: Music,
  FONTS: Type,
  SCRIPTS: Code,
  TILESETS: Grid3x3,
}

const ASSET_ICON_COLOR: Record<string, string> = {
  IMAGES: 'var(--accent)',
  AUDIO: 'var(--accent-2)',
  FONTS: 'var(--warn)',
  TILESETS: 'var(--purple)',
}

function assetIconColor(type: string): string {
  return ASSET_ICON_COLOR[type] ?? 'var(--warn)'
}

function AssetIcon({ type }: Readonly<{ type: string }>) {
  const Icon = ICON_MAP[type] ?? FileText
  return <Icon size={22} color={assetIconColor(type)} />
}

function audioMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? 'ogg'
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'wav') return 'audio/wav'
  return 'audio/ogg'
}

function selectCardKeyDown(e: ReactKeyboardEvent, onSelect: () => void): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    onSelect()
  }
}

export type ImageAssetCardProps = Readonly<{
  asset: ImageAsset
  selected: boolean
  entityName: string | null
  onSelect: () => void
  onAssign: () => void
}>

export function ImageAssetCard({
  asset,
  selected,
  entityName,
  onSelect,
  onAssign,
}: ImageAssetCardProps) {
  const title = entityName
    ? `Double-click → assign as sprite of "${entityName}"`
    : 'Select an entity, then double-click to assign as its sprite'

  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onAssign}
      title={title}
      className={`${CARD_BTN} ${selected ? CARD_SELECTED : CARD_IDLE}`}
    >
      <div className="w-[22px] h-[22px] flex items-center justify-center group-hover:scale-110 transition-transform">
        {asset.dataUrl ? (
          <img
            src={asset.dataUrl}
            alt={asset.name}
            className="max-w-full max-h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <AssetIcon type="IMAGES" />
        )}
      </div>
      <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
        {asset.name}
      </span>
      <span className="text-[8px] text-[rgb(var(--muted-rgb)/0.5)]">image</span>
    </button>
  )
}

export type AudioAssetCardProps = Readonly<{
  asset: AudioAsset
  projectRoot: string | null
  selected: boolean
  onSelect: () => void
}>

export function AudioAssetCard({ asset, projectRoot, selected, onSelect }: AudioAssetCardProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!projectRoot) {
      setSrc(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    void readProjectFileBytes(projectRoot, asset.path).then((bytes) => {
      if (cancelled || !bytes || bytes.length === 0) return
      const blob = new Blob([bytesToArrayBuffer(bytes)], { type: audioMimeFromPath(asset.path) })
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [projectRoot, asset.path])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => selectCardKeyDown(e, onSelect)}
      title={`${asset.path}\nClick to select · Delete to remove`}
      className={`${CARD_BTN} ${selected ? CARD_SELECTED : CARD_IDLE}`}
    >
      {src ? (
        <audio
          controls
          src={src}
          className="w-full h-8"
          preload="metadata"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <AssetIcon type="AUDIO" />
      )}
      <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
        {asset.name}
      </span>
    </div>
  )
}

export type TilesetAssetCardProps = Readonly<{
  tileset: TilesetAsset
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}>

export function TilesetAssetCard({ tileset, selected, onSelect, onOpen }: TilesetAssetCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onOpen}
      title="Click to select · Double-click to open Tileset Editor"
      className={`${CARD_BTN} ${
        selected
          ? CARD_SELECTED
          : 'border-[var(--border)] hover:border-[var(--purple)] hover:bg-[var(--panel-3)]'
      }`}
    >
      <div className="w-[22px] h-[22px] flex items-center justify-center group-hover:scale-110 transition-transform">
        <AssetIcon type="TILESETS" />
      </div>
      <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">
        {tileset.name}
      </span>
      <span className="text-[8px] text-[rgb(var(--muted-rgb)/0.6)] tabular-nums">
        {tileset.tileSize}px · {tileset.cols}×{tileset.rows}
      </span>
    </button>
  )
}

export function FontAssetCard({
  name,
  path,
  defaultSize,
  selected,
  onSelect,
}: Readonly<{
  name: string
  path: string
  defaultSize?: number
  selected: boolean
  onSelect: () => void
}>) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${CARD_BTN} ${selected ? CARD_SELECTED : CARD_IDLE}`}
      title={`${path}\nLua: text.draw("${path}", "Hello", x, y, ${defaultSize ?? 32})`}
    >
      <AssetIcon type="FONTS" />
      <span className="text-[9px] truncate w-full text-center text-[var(--muted)]">{name}</span>
      {defaultSize != null && (
        <span className="text-[8px] text-[var(--muted)]">{defaultSize}px</span>
      )}
    </button>
  )
}
