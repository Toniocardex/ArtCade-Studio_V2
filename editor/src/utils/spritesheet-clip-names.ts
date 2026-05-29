import type { ProjectDoc } from '../types'

/** First duplicate clip name used on another image asset, if any. */
export function findDuplicateClipNameAcrossAssets(
  project: ProjectDoc,
  clipName: string,
  excludeAssetId: string,
): string | null {
  const needle = clipName.trim()
  if (!needle) return null
  for (const [assetId, asset] of Object.entries(project.assets ?? {})) {
    if (assetId === excludeAssetId) continue
    for (const clip of asset.clips ?? []) {
      if (clip.name.trim() === needle) return asset.name || assetId
    }
  }
  return null
}
