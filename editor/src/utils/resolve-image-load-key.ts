// ---------------------------------------------------------------------------
// resolve-image-load-key — dual-read id vs path (§3.4)
// ---------------------------------------------------------------------------

import type { ImageAsset, ProjectDoc } from '../types'

const warnedOrphanRefs = new Set<string>()

/** Reset session dedupe (tests). */
export function resetResolveImageLoadKeyWarnings(): void {
  warnedOrphanRefs.clear()
}

function warnOrphanOnce(ref: string): void {
  if (warnedOrphanRefs.has(ref)) return
  warnedOrphanRefs.add(ref)
  console.warn(`[Asset] Legacy orphan image reference (not in library): ${ref}`)
}

/**
 * Resolve a sprite/tileset reference to the project-relative path used as the
 * WASM texture cache key.
 */
export function resolveImageLoadKey(project: ProjectDoc, ref: string): string {
  const trimmed = ref.trim()
  if (!trimmed) return ''

  const assets = Object.values(project.assets ?? {})
  const byId = new Map(assets.map((a) => [a.id, a]))
  const byPath = new Map(assets.map((a) => [a.path, a]))

  const byIdHit = byId.get(trimmed)
  if (byIdHit) return byIdHit.path

  if (byPath.has(trimmed)) return trimmed

  warnOrphanOnce(trimmed)
  return trimmed
}

export function imageAssetForPath(
  project: ProjectDoc,
  path: string,
): ImageAsset | undefined {
  return Object.values(project.assets ?? {}).find((a) => a.path === path)
}
