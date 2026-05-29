// ---------------------------------------------------------------------------
// build-project-asset-manifest — stable asset index for .artcade export (Phase C)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'

export type AssetManifestKind = 'image' | 'audio' | 'font'

export interface AssetManifestEntry {
  id: string
  type: AssetManifestKind
  relativePath: string
  sha256?: string
}

export interface ProjectAssetManifest {
  version: string
  exportedAt: string
  assets: AssetManifestEntry[]
  checksums: Record<string, string>
}

/** Build manifest asset table from ProjectDoc libraries (§6 Phase C). */
export function buildProjectAssetManifest(
  project: ProjectDoc,
  checksums: Record<string, string> = {},
  exportedAt: string = new Date().toISOString(),
): ProjectAssetManifest {
  const assets: AssetManifestEntry[] = []

  for (const asset of Object.values(project.assets ?? {})) {
    const relativePath = asset.path?.trim()
    if (!relativePath) continue
    assets.push({
      id: asset.id,
      type: 'image',
      relativePath,
      ...(checksums[relativePath] ? { sha256: checksums[relativePath] } : {}),
    })
  }

  for (const asset of Object.values(project.audioAssets ?? {})) {
    const relativePath = asset.path?.trim()
    if (!relativePath) continue
    assets.push({
      id: asset.id,
      type: 'audio',
      relativePath,
      ...(checksums[relativePath] ? { sha256: checksums[relativePath] } : {}),
    })
  }

  for (const asset of Object.values(project.fontAssets ?? {})) {
    const relativePath = asset.path?.trim()
    if (!relativePath) continue
    assets.push({
      id: asset.id,
      type: 'font',
      relativePath,
      ...(checksums[relativePath] ? { sha256: checksums[relativePath] } : {}),
    })
  }

  assets.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  return {
    version: '1.0.0',
    exportedAt,
    assets,
    checksums,
  }
}
