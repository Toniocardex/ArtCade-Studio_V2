import type { ImageAsset } from '../types'
import { bytesToArrayBuffer } from './asset-file-api'

function mimeForImagePath(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? 'png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

export function isBlobPreviewSrc(src: string | null): boolean {
  return src != null && src.startsWith('blob:')
}

/**
 * Resolve a display URL for an image asset (dataUrl or project file).
 * Caller must revoke blob URLs via `revokeImagePreviewSrc` when done.
 */
export async function resolveImagePreviewSrc(
  asset: Pick<ImageAsset, 'dataUrl' | 'path'>,
  projectPath: string | null,
): Promise<string | null> {
  if (asset.dataUrl) return asset.dataUrl
  if (!projectPath || !asset.path?.trim()) return null

  const { readProjectFileBytes } = await import('./asset-file-api')
  const { dirName } = await import('./project')
  const bytes = await readProjectFileBytes(dirName(projectPath), asset.path)
  if (!bytes) return null
  const blob = new Blob([bytesToArrayBuffer(bytes)], { type: mimeForImagePath(asset.path) })
  return URL.createObjectURL(blob)
}

export function revokeImagePreviewSrc(src: string | null): void {
  if (isBlobPreviewSrc(src)) URL.revokeObjectURL(src!)
}

export function measureImageNaturalSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}
