import { useEffect, useState, type MouseEvent } from 'react'
import { Image } from 'lucide-react'
import {
  isBlobPreviewSrc,
  resolveImagePreviewSrc,
  revokeImagePreviewSrc,
} from '../../utils/image-preview-src'

export type AssetTreeThumbnailProps = Readonly<{
  path?: string
  dataUrl?: string
  projectPath: string | null
  onOpen: () => void
  openTitle: string
}>

/** Small tree icon with optional async preview from project file. */
export function AssetTreeThumbnail({
  path,
  dataUrl,
  projectPath,
  onOpen,
  openTitle,
}: AssetTreeThumbnailProps) {
  const [src, setSrc] = useState<string | null>(dataUrl ?? null)

  useEffect(() => {
    let cancelled = false

    if (dataUrl) {
      setSrc(dataUrl)
      return
    }

    if (!path?.trim()) {
      setSrc(null)
      return
    }

    void (async () => {
      const next = await resolveImagePreviewSrc({ path, dataUrl }, projectPath)
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
        return dataUrl ?? null
      })
    }
  }, [dataUrl, path, projectPath])

  const openFromThumbnail = (e: MouseEvent) => {
    e.stopPropagation()
    onOpen()
  }

  if (!src) {
    return (
      <span
        className="inline-flex flex-shrink-0"
        title={openTitle}
        onDoubleClick={openFromThumbnail}
      >
        <Image size={11} className="text-[var(--muted)]" aria-hidden />
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className="w-4 h-4 object-contain flex-shrink-0"
      style={{ imageRendering: 'pixelated' }}
      title={openTitle}
      onDoubleClick={openFromThumbnail}
    />
  )
}
