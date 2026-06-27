// ---------------------------------------------------------------------------
// asset-ref-contract — stable library id vs legacy path references
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'
import { imageAssetForRef } from './resolve-image-load-key'

const PATH_LIKE_REF_RE = /[/\\]/

/** True when a reference string looks like a project-relative file path. */
export function isPathLikeAssetRef(ref: string): boolean {
  return PATH_LIKE_REF_RE.test(ref.trim())
}

/**
 * True when `ref` is already a stable image library id (not a legacy path alias).
 */
export function isStableImageAssetRef(project: ProjectDoc, ref: string): boolean {
  const trimmed = ref.trim()
  if (!trimmed || isPathLikeAssetRef(trimmed)) return false
  const asset = imageAssetForRef(project, trimmed)
  return asset?.id === trimmed
}

/**
 * When a sprite ref is path-shaped but resolves to a library row, return the stable id.
 */
export function stableImageAssetIdForRef(
  project: ProjectDoc,
  ref: string,
): string | null {
  const trimmed = ref.trim()
  if (!trimmed) return null
  const asset = imageAssetForRef(project, trimmed)
  if (!asset) return null
  if (asset.id === trimmed) return asset.id
  if (isPathLikeAssetRef(trimmed)) return asset.id
  return null
}
