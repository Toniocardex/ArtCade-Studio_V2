import { useEffect, useState } from 'react'
import type { ImageAsset } from '../../types'
import { spritesheetStudioTriggerProps } from '../../panels/spritesheet-studio/openSpritesheetStudio'
import {
  isBlobPreviewSrc,
  resolveImagePreviewSrc,
  revokeImagePreviewSrc,
} from '../../utils/image-preview-src'

export type ImageAssetPreviewProps = Readonly<{
  asset: ImageAsset
  projectPath: string | null
  onOpenStudio: () => void
}>

export function ImageAssetPreview({ asset, projectPath, onOpenStudio }: ImageAssetPreviewProps) {
  const [src, setSrc] = useState<string | null>(asset.dataUrl ?? null)

  useEffect(() => {
    let cancelled = false

    if (asset.dataUrl) {
      setSrc(asset.dataUrl)
      return
    }

    void (async () => {
      const next = await resolveImagePreviewSrc(asset, projectPath)
      if (cancelled) {
        if (isBlobPreviewSrc(next)) revokeImagePreviewSrc(next)
        return
      }
      setSrc((prev) => {
        if (isBlobPreviewSrc(prev)) revokeImagePreviewSrc(prev)
        return next
      })
    })()

    return () => {
      cancelled = true
      setSrc((prev) => {
        if (isBlobPreviewSrc(prev)) revokeImagePreviewSrc(prev)
        return asset.dataUrl ?? null
      })
    }
  }, [asset.dataUrl, asset.path, projectPath])

  if (!src) {
    return (
      <p className="text-[9px] text-[var(--muted)]">
        Save the project to preview this image from disk, or re-import it.
      </p>
    )
  }

  const activateStudio = () => {
    onOpenStudio()
  }

  return (
    <button
      type="button"
      {...spritesheetStudioTriggerProps}
      className="w-full rounded border border-[var(--border)] bg-[var(--bg)] p-2 flex items-center justify-center
                 hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      onDoubleClick={(e) => {
        e.preventDefault()
        activateStudio()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          activateStudio()
        }
      }}
      aria-label={`Open Sprite Studio for ${asset.name}`}
      title="Double-click or press Enter to open Sprite Studio"
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="max-w-full max-h-32 object-contain pointer-events-none"
        style={{ imageRendering: 'pixelated' }}
      />
    </button>
  )
}
