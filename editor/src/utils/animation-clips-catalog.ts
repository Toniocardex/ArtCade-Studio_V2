import type { AnimationClipDef, ImageAsset, ProjectDoc } from '../types'
import { findImageAssetByPath } from './sprite-pivot-resolve'

export type ProjectClipEntry = Readonly<{
  clipName: string
  assetId: string
  assetLabel: string
  spritePath: string
}>

export function assetDisplayLabel(asset: ImageAsset, assetId: string): string {
  return asset.name?.trim() || assetId
}

export function formatClipOption(clipName: string, asset: ImageAsset, assetId: string): string {
  return `${clipName} — ${assetDisplayLabel(asset, assetId)}`
}

/** All clips in the project (one row per clip definition). */
export function listProjectClips(
  project: ProjectDoc | null | undefined,
  filterSpritePath?: string,
): ProjectClipEntry[] {
  if (!project?.assets) return []
  const out: ProjectClipEntry[] = []
  for (const [assetId, asset] of Object.entries(project.assets)) {
    for (const clip of asset.clips ?? []) {
      const clipName = clip.name.trim()
      if (!clipName || clip.frames.length === 0) continue
      out.push({
        clipName,
        assetId,
        assetLabel: assetDisplayLabel(asset, assetId),
        spritePath: asset.path,
      })
    }
  }
  out.sort((a, b) => {
    const byName = a.clipName.localeCompare(b.clipName)
    if (byName !== 0) return byName
    return a.assetLabel.localeCompare(b.assetLabel)
  })
  const needle = filterSpritePath?.trim()
  if (!needle) return out
  // Match the object's sheet the same way the inspector / Sprite Studio do
  // (path OR id), then accept any asset entry that resolves to the same sheet
  // identity — path, id, or filename. A strict `path === needle` check hid clips
  // when the object referenced a different asset entry for the same image.
  const target = findImageAssetByPath(project.assets, needle)
  const identities = new Set<string>([needle])
  if (target) {
    if (target.path) identities.add(target.path)
    if (target.name) identities.add(target.name)
    identities.add(target.id)
  }
  return out.filter(
    (e) =>
      identities.has(e.spritePath)
      || identities.has(e.assetId)
      || identities.has(e.assetLabel),
  )
}

export function clipsForSpritePath(
  project: ProjectDoc | null | undefined,
  spritePath: string,
): AnimationClipDef[] {
  const asset = findImageAssetByPath(project?.assets, spritePath)
  return asset?.clips ?? []
}

export function clipExistsOnSpritePath(
  project: ProjectDoc | null | undefined,
  spritePath: string,
  clipName: string,
): boolean {
  const needle = clipName.trim()
  if (!needle) return false
  return clipsForSpritePath(project, spritePath).some((c) => c.name.trim() === needle)
}
