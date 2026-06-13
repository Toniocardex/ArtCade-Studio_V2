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

/** Resolve an image library entry from its record key, stable id, or path. */
export function imageAssetForRef(
  project: ProjectDoc,
  ref: string,
): ImageAsset | undefined {
  const trimmed = ref.trim()
  if (!trimmed) return undefined
  return project.assets?.[trimmed]
    ?? Object.values(project.assets ?? {}).find(
      (asset) => asset.id === trimmed || asset.path === trimmed,
    )
}

/**
 * Resolve a sprite/tileset reference to the project-relative path used as the
 * WASM texture cache key.
 */
export function resolveImageLoadKey(project: ProjectDoc, ref: string): string {
  const trimmed = ref.trim()
  if (!trimmed) return ''

  const asset = imageAssetForRef(project, trimmed)
  if (asset) return asset.path

  warnOrphanOnce(trimmed)
  return trimmed
}

export function imageAssetForPath(
  project: ProjectDoc,
  path: string,
): ImageAsset | undefined {
  return Object.values(project.assets ?? {}).find((a) => a.path === path)
}
