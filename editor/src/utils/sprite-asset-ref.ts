// ---------------------------------------------------------------------------
// sprite-asset-ref — canonical sprite library reference helpers (Prototype Sprite ADR)
// ---------------------------------------------------------------------------
//
// spriteAssetId is always a stable ImageAsset.id at authoring time.
// resolveImageLoadKey(project, ref) is the only path to a WASM texture key.

import type { AnimationClipDef, ProjectDoc, SpriteComponent } from '../types'
import { imageAssetForRef, resolveImageLoadKey } from './resolve-image-load-key'

export { imageAssetForRef, resolveImageLoadKey }

/** Image asset identity for sprite ref matching (id + path dual-read). */
export type ImageAssetMatch = Readonly<{ id: string; path: string }>

/** Normalize empty / whitespace sprite refs to null. */
export function normalizeSpriteAssetRef(ref: string | null | undefined): string | null {
  if (ref == null) return null
  const trimmed = ref.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Stable image library id on a sprite component, or null when intentionally empty. */
export function spriteAssetRef(sprite: SpriteComponent): string | null {
  return normalizeSpriteAssetRef(sprite.spriteAssetId)
}

/** True when the sprite has a library reference (prototype or imported). */
export function hasSpriteVisual(sprite: SpriteComponent): boolean {
  return spriteAssetRef(sprite) != null
}

/**
 * True when a sprite ref points at the given image asset (stable id or legacy path).
 */
export function spriteReferencesImageAsset(
  project: ProjectDoc,
  sprite: SpriteComponent | undefined,
  target: ImageAssetMatch,
): boolean {
  const ref = spriteAssetRef(sprite ?? emptySprite())
  if (!ref) return false
  if (ref === target.id || ref === target.path) return true
  const resolved = imageAssetForRef(project, ref)
  return resolved?.id === target.id || resolved?.path === target.path
}

/** Sprite with no visual and no clip spawn fields. */
export function clearedSpriteComponent(sprite: SpriteComponent): SpriteComponent {
  return {
    ...sprite,
    spriteAssetId: null,
    defaultClip: undefined,
    playClipOnSpawn: false,
  }
}

/**
 * Detach every entity / object-type sprite that references the removed image asset.
 */
export function detachImageAssetFromSprites(
  project: ProjectDoc,
  target: ImageAssetMatch,
): ProjectDoc {
  const maybeClear = <T extends { sprite?: SpriteComponent }>(entry: T): T => {
    if (!entry.sprite || !spriteReferencesImageAsset(project, entry.sprite, target)) return entry
    return { ...entry, sprite: clearedSpriteComponent(entry.sprite) }
  }
  const entities = Object.fromEntries(
    Object.entries(project.entities ?? {}).map(([id, entity]) => [id, maybeClear(entity)]),
  )
  if (!project.objectTypes) return { ...project, entities }
  const objectTypes = Object.fromEntries(
    Object.entries(project.objectTypes).map(([id, type]) => [id, maybeClear(type)]),
  )
  return { ...project, entities, objectTypes }
}

function emptySprite(): SpriteComponent {
  return {
    spriteAssetId: null,
    tint: { x: 1, y: 1, z: 1, w: 1 },
    fillColor: { x: 1, y: 1, z: 1 },
    alpha: 1,
    pivot: { x: 0.5, y: 0.5 },
    renderOrder: 0,
  }
}

function firstValidClipName(clips: AnimationClipDef[]): string | undefined {
  return clips.find((clip) => clip.name.trim() && clip.frames.length > 0)?.name.trim()
}

function clipNameExists(clips: AnimationClipDef[], name: string | undefined): boolean {
  const needle = name?.trim()
  if (!needle) return false
  return clips.some((clip) => clip.name.trim() === needle && clip.frames.length > 0)
}

function spriteWithClipDefaultsForAsset(
  project: ProjectDoc,
  sprite: SpriteComponent,
  target: ImageAssetMatch,
  clips: AnimationClipDef[],
): SpriteComponent {
  if (!spriteReferencesImageAsset(project, sprite, target)) return sprite
  if (clipNameExists(clips, sprite.defaultClip)) return sprite
  const defaultClip = firstValidClipName(clips)
  return {
    ...sprite,
    defaultClip,
    playClipOnSpawn: defaultClip ? sprite.playClipOnSpawn === true : false,
  }
}

/**
 * After clips change on an image asset, sync defaultClip on linked sprites.
 */
export function applyClipDefaultsForImageAsset(
  project: ProjectDoc,
  target: ImageAssetMatch,
  clips: AnimationClipDef[],
): ProjectDoc {
  const patchSprite = <T extends { sprite: SpriteComponent }>(entry: T): T => {
    const sprite = spriteWithClipDefaultsForAsset(project, entry.sprite, target, clips)
    return sprite === entry.sprite ? entry : { ...entry, sprite }
  }
  const entities = Object.fromEntries(
    Object.entries(project.entities ?? {}).map(([id, entity]) => [id, patchSprite(entity)]),
  )
  if (!project.objectTypes) return { ...project, entities }
  const objectTypes = Object.fromEntries(
    Object.entries(project.objectTypes).map(([id, type]) => [id, patchSprite(type)]),
  )
  return { ...project, entities, objectTypes }
}

/**
 * Resolve a sprite component to the project-relative texture load key for WASM.
 * Returns '' when the sprite intentionally has no visual.
 */
export function resolveSpriteLoadKey(project: ProjectDoc, sprite: SpriteComponent): string {
  const ref = spriteAssetRef(sprite)
  if (!ref) return ''
  return resolveImageLoadKey(project, ref)
}

/** Resolve a raw sprite ref string (id or legacy path) to a load key. */
export function resolveSpriteRefLoadKey(project: ProjectDoc, ref: string | null | undefined): string {
  const normalized = normalizeSpriteAssetRef(ref)
  if (!normalized) return ''
  return resolveImageLoadKey(project, normalized)
}
