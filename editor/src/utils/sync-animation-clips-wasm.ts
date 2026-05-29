// ---------------------------------------------------------------------------
// sync-animation-clips-wasm — push ImageAsset.clips to WASM SpriteAnimator
// ---------------------------------------------------------------------------

import type { ImageAsset, ProjectDoc } from '../types'
import { editorReregisterAnimationClips, isReady } from './wasm-bridge'

/** Build `{ assets: { [id]: { path, clips } } }` for C++ parseImageAssets. */
export function animationClipsPayloadForWasm(project: ProjectDoc): string {
  const assets: Record<string, Pick<ImageAsset, 'path' | 'clips'>> = {}
  for (const asset of Object.values(project.assets ?? {})) {
    if (!asset.clips?.length) continue
    const path = asset.path?.trim() || asset.id
    assets[asset.id] = { path, clips: asset.clips }
  }
  return JSON.stringify({ assets })
}

/** Hot-sync animation clips when WASM preview is running (no full project load). */
export function syncAnimationClipsToWasm(project: ProjectDoc | null): boolean {
  if (!project || !isReady()) return false
  return editorReregisterAnimationClips(animationClipsPayloadForWasm(project)) === 0
}
