import { useEffect, useState } from 'react'
import type { ImageAsset } from '../../types'
import { spritesheetStudioTriggerProps } from '../../panels/spritesheet-studio/openSpritesheetStudio'
import { bytesToArrayBuffer } from '../../utils/asset-file-api'

function mimeForImagePath(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? 'png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

export type ImageAssetPreviewProps = Readonly<{
  asset: ImageAsset
  projectPath: string | null
  onOpenStudio: () => void
}>

export function ImageAssetPreview({ asset, projectPath, onOpenStudio }: ImageAssetPreviewProps) {
  const [src, setSrc] = useState<string | null>(asset.dataUrl ?? null)

  useEffect(() => {
    if (asset.dataUrl) {
      setSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return asset.dataUrl ?? null
      })
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    if (!projectPath || !asset.path?.trim()) {
      setSrc(null)
      return
    }

    void (async () => {
      const { readProjectFileBytes } = await import('../../utils/asset-file-api')
      const { dirName } = await import('../../utils/project')
      const root = dirName(projectPath)
      const bytes = await readProjectFileBytes(root, asset.path)
      if (cancelled) return
      if (!bytes) {
        setSrc(null)
        return
      }
      objectUrl = URL.createObjectURL(
        new Blob([bytesToArrayBuffer(bytes)], { type: mimeForImagePath(asset.path) }),
      )
      if (cancelled) {
        URL.revokeObjectURL(objectUrl)
        return
      }
      setSrc((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        return objectUrl
      })
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [asset.id, asset.dataUrl, asset.path, projectPath])

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
      aria-label={`Open Spritesheet Studio for ${asset.name}`}
      title="Double-click or press Enter to open Spritesheet Studio"
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="max-w-full max-h-32 object-contain"
        style={{ imageRendering: 'pixelated' }}
      />
    </button>
  )
}
