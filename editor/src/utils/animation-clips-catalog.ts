import type { AnimationClipDef, ImageAsset, ProjectDoc } from '../types'
import type { LogicBoard } from '../types/logic-board'
import { logicBoardTargetEntityIds } from './project-queries'
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

/** Sprite sheet path for entity-scoped rulesheets (entity_id / object_type). */
export function spritePathForLogicBoardTarget(
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
): string | undefined {
  if (!project || !board) return undefined
  const t = board.target.type
  if (t !== 'entity_id' && t !== 'object_type') return undefined
  const ids = logicBoardTargetEntityIds(project, board)
  const firstId = ids[0]
  if (firstId == null) return undefined
  const path = project.entities[firstId]?.sprite.spriteAssetId?.trim()
  return path || undefined
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
  return out.filter((e) => e.spritePath === needle)
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
