import type { ProjectDoc } from '../types'
import type { ImportedAssetKind } from './asset-file-api'

export function contentHashesForAssetKind(
  project: ProjectDoc,
  kind: ImportedAssetKind,
): ReadonlySet<string> {
  const hashes =
    kind === 'image'
      ? Object.values(project.assets ?? {}).map((asset) => asset.contentHash)
      : kind === 'audio'
        ? Object.values(project.audioAssets ?? {}).map((asset) => asset.contentHash)
        : kind === 'font'
          ? Object.values(project.fontAssets ?? {}).map((asset) => asset.contentHash)
          : Object.values(project.tilesets ?? {}).map((asset) => asset.contentHash)
  return new Set(hashes.filter((hash): hash is string => Boolean(hash)))
}
