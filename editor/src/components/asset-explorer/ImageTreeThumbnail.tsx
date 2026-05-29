import type { MouseEvent } from 'react'
import { Image } from 'lucide-react'
import type { ImageAsset } from '../../types'

type ImageTreeThumbnailProps = Readonly<{
  asset: ImageAsset | undefined
  onOpenStudio: () => void
}>

/** Small tree icon; double-click opens Spritesheet Studio without triggering row double-click. */
export function ImageTreeThumbnail({ asset, onOpenStudio }: ImageTreeThumbnailProps) {
  if (!asset) {
    return <Image size={11} className="flex-shrink-0 text-[var(--accent)]" aria-hidden />
  }

  const openFromThumbnail = (e: MouseEvent) => {
    e.stopPropagation()
    onOpenStudio()
  }

  if (!asset.dataUrl) {
    return (
      <span
        className="inline-flex flex-shrink-0"
        title="Double-click to open Sprite Studio"
        onDoubleClick={openFromThumbnail}
      >
        <Image size={11} className="text-[var(--accent)]" aria-hidden />
      </span>
    )
  }

  return (
    <img
      src={asset.dataUrl}
      alt=""
      className="w-4 h-4 object-contain flex-shrink-0"
      style={{ imageRendering: 'pixelated' }}
      title="Double-click to open Spritesheet Studio"
      onDoubleClick={openFromThumbnail}
    />
  )
}
