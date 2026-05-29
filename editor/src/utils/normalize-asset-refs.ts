// ---------------------------------------------------------------------------
// normalize-asset-refs — optional migration: paths → stable asset ids (Phase 1c)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'
import { resolveImageLoadKey } from './resolve-image-load-key'

export type NormalizeAssetRefsResult = Readonly<{
  changed: number
  project: ProjectDoc
}>

/** Rewrite sprite/tileset refs to ImageAsset.id where a library match exists. */
export function normalizeAssetRefs(project: ProjectDoc): NormalizeAssetRefsResult {
  let changed = 0
  const next: ProjectDoc = {
    ...project,
    entities: { ...project.entities },
    tilesets: project.tilesets ? { ...project.tilesets } : undefined,
  }

  for (const [eid, ent] of Object.entries(next.entities)) {
    const raw = ent.sprite?.spriteAssetId?.trim()
    if (!raw) continue
    const path = resolveImageLoadKey(project, raw)
    const lib = path
      ? Object.values(project.assets ?? {}).find((a) => a.path === path)
      : undefined
    if (!lib || lib.id === raw) continue
    next.entities[Number(eid)] = {
      ...ent,
      sprite: { ...ent.sprite, spriteAssetId: lib.id },
    }
    changed++
  }

  if (next.tilesets) {
    for (const [tid, ts] of Object.entries(next.tilesets)) {
      const raw = ts.spriteImagePath?.trim()
      if (!raw) continue
      const path = resolveImageLoadKey(project, raw)
      const lib = path
        ? Object.values(project.assets ?? {}).find((a) => a.path === path)
        : undefined
      if (!lib || lib.id === raw) continue
      next.tilesets![tid] = { ...ts, spriteImagePath: lib.id }
      changed++
    }
  }

  return { changed, project: next }
}
