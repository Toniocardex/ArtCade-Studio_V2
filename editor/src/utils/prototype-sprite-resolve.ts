// ---------------------------------------------------------------------------
// prototype-sprite-resolve — single source of truth for prototype visuals
// ---------------------------------------------------------------------------
//
// Authority: objectTypeId → gen_proto_{typeId} → palette / PNG / WASM path.
// Inspector, asset explorer, and WASM upload must resolve through this module.

import type { ImageAsset, ProjectDoc, Vec3 } from '../types'
import { findSceneInstance } from './project-object-types'
import {
  colorFromObjectTypeId,
  generatePrototypeSpriteDataUrl,
  hydrateGeneratedAssetDataUrls,
  isGeneratedPrototypeAsset,
  prototypeAssetIdForType,
  prototypeAssetMatchesType,
  prototypeOwnerTypeIdFromAsset,
  prototypeSpriteVirtualPath,
  PROTOTYPE_SPRITE_SIZE,
  rebindAllObjectTypePrototypeSprites,
  resolvePrototypeBaseColor,
} from './prototype-sprite'

/** Canonical resolved state for one prototype sprite (all surfaces consume this). */
export type PrototypeSpriteView = Readonly<{
  /** Owning object type id — authoritative identity */
  typeId: string
  assetId: string
  loadPath: string
  baseColor: Vec3
  dataUrl: string
  /** `objectTypes[typeId].sprite.spriteAssetId` matches `assetId` and asset metadata */
  bindingOk: boolean
}>

function buildPrototypeView(options: {
  typeId: string
  asset: ImageAsset | undefined
  boundRef: string
}): PrototypeSpriteView {
  const typeId = options.typeId.trim()
  const assetId = prototypeAssetIdForType(typeId)
  const loadPath = prototypeSpriteVirtualPath(assetId)
  const asset = options.asset
  const bindingOk =
    options.boundRef === assetId
    && asset != null
    && prototypeAssetMatchesType(asset, typeId)

  const width = asset?.generated?.width ?? PROTOTYPE_SPRITE_SIZE
  const height = asset?.generated?.height ?? PROTOTYPE_SPRITE_SIZE
  const baseColor = bindingOk && asset
    ? resolvePrototypeBaseColor(asset, typeId)
    : colorFromObjectTypeId(typeId)
  const dataUrl = generatePrototypeSpriteDataUrl(width, height, baseColor)

  return { typeId, assetId, loadPath, baseColor, dataUrl, bindingOk }
}

/**
 * Canonical prototype visual for an object type.
 * Inspector, thumbnails, and WASM must use this (or instance/asset wrappers).
 */
export function resolvePrototypeSpriteForType(
  project: ProjectDoc,
  typeId: string,
): PrototypeSpriteView | null {
  const trimmed = typeId.trim()
  if (!trimmed || !project.objectTypes?.[trimmed]) return null
  const type = project.objectTypes[trimmed]
  const asset = project.assets?.[prototypeAssetIdForType(trimmed)]
  const boundRef = type.sprite.spriteAssetId?.trim() ?? ''
  const view = buildPrototypeView({ typeId: trimmed, asset, boundRef })
  return view
}

/** Prototype visual for a placed scene instance (uses `objectTypeId`, not display name). */
export function resolvePrototypeSpriteForInstance(
  project: ProjectDoc,
  instanceId: number,
): PrototypeSpriteView | null {
  const found = findSceneInstance(project, instanceId)
  if (!found) return null
  return resolvePrototypeSpriteForType(project, found.instance.objectTypeId)
}

/**
 * Prototype visual for a library asset row.
 * When the type exists in the project, delegates to type-authoritative resolution.
 */
export function resolvePrototypeSpriteFromAsset(
  project: ProjectDoc | null | undefined,
  asset: ImageAsset,
): PrototypeSpriteView | null {
  if (!isGeneratedPrototypeAsset(asset)) return null
  const typeId = prototypeOwnerTypeIdFromAsset(asset)
  if (!typeId) return null
  if (project?.objectTypes?.[typeId]) {
    return resolvePrototypeSpriteForType(project, typeId)
  }
  const expectedId = prototypeAssetIdForType(typeId)
  const libraryAsset = project?.assets?.[expectedId] ?? asset
  return buildPrototypeView({
    typeId,
    asset: libraryAsset,
    boundRef: libraryAsset.id,
  })
}

/**
 * Preview / WASM upload data URL.
 * Generated prototypes always route through the type-authoritative resolver.
 */
export function resolveImageAssetDataUrl(
  asset: ImageAsset | undefined,
  project?: ProjectDoc | null,
): string | undefined {
  if (!asset) return undefined
  if (!isGeneratedPrototypeAsset(asset)) return asset.dataUrl
  const view = resolvePrototypeSpriteFromAsset(project, asset)
  if (!view) return asset.dataUrl
  return view.dataUrl
}

/**
 * Load pipeline: repair per-type bindings, then sync generated PNG bytes in assets.
 */
export function normalizePrototypeSprites(project: ProjectDoc): {
  project: ProjectDoc
  changed: boolean
} {
  const { project: rebound, changed: rebindChanged } = rebindAllObjectTypePrototypeSprites(project)
  const hydrated = hydrateGeneratedAssetDataUrls(rebound)
  return {
    project: hydrated,
    changed: rebindChanged || hydrated !== rebound,
  }
}
