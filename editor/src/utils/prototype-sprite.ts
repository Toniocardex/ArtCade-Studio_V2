// ---------------------------------------------------------------------------
// prototype-sprite — generated placeholder sprites for new object types (ADR)
// ---------------------------------------------------------------------------

import type { ImageAsset, ObjectTypeDef, ProjectDoc, SpriteComponent, Vec3 } from '../types'
import type { Action } from '../store/editor-store-state'
import type { ImportedAssetFile } from './asset-file-api'
import { importAssetFile } from './asset-file-api'
import { hexToFillColor } from './sprite-fill-color'
import { slugTypeId } from './project-object-types'
import { pngBytesToDataUrl, solidColorPngBytes } from './solid-color-png'

export const PROTOTYPE_SPRITE_SIZE = 32
export const GENERATED_PROTOTYPE_PATH_PREFIX = '__generated__/prototype/'

const PALETTE_HEX = [
  '#4C9AFF', '#E74C3C', '#2ECC71', '#F1C40F', '#9B59B6',
  '#1ABC9C', '#E67E22', '#3498DB', '#E91E63', '#00BCD4',
] as const

/** Virtual project-relative path used as the WASM texture cache key. */
export function prototypeSpriteVirtualPath(assetId: string): string {
  return `${GENERATED_PROTOTYPE_PATH_PREFIX}${assetId}.png`
}

/** Stable generated asset id for an object type's prototype sprite. */
export function prototypeAssetIdForType(typeId: string): string {
  return `gen_proto_${typeId}`
}

const GEN_PROTO_ID_PREFIX = 'gen_proto_'

/**
 * Owning object type id for palette lookup: persisted metadata, then stable asset id.
 */
export function prototypeOwnerTypeIdFromAsset(
  asset: Pick<ImageAsset, 'id' | 'generated'>,
): string | undefined {
  const fromMeta = asset.generated?.ownerTypeId?.trim()
  if (fromMeta) return fromMeta
  if (asset.id.startsWith(GEN_PROTO_ID_PREFIX)) {
    const typeId = asset.id.slice(GEN_PROTO_ID_PREFIX.length).trim()
    if (typeId) return typeId
  }
  return undefined
}

/** Deterministic accent color from object type id (editor preview + migration). */
export function colorFromObjectTypeId(typeId: string): Vec3 {
  let hash = 0
  for (let i = 0; i < typeId.length; i++) {
    hash = (hash * 31 + typeId.charCodeAt(i)) >>> 0
  }
  const hex = PALETTE_HEX[hash % PALETTE_HEX.length]
  return hexToFillColor(hex) ?? { x: 0.3, y: 0.6, z: 1 }
}

/**
 * Build a PNG data URL for a solid-color rectangle prototype sprite.
 * Uses canvas when available (editor); headless tests get a minimal 1×1 PNG.
 */
export function generatePrototypeSpriteDataUrl(
  width: number,
  height: number,
  color: Vec3,
): string {
  const r = Math.round(color.x * 255)
  const g = Math.round(color.y * 255)
  const b = Math.round(color.z * 255)
  const bytes = solidColorPngBytes(width, height, r, g, b)
  const dataUrl = pngBytesToDataUrl(bytes)
  return dataUrl
}

export interface GeneratePrototypeSpriteAssetOptions {
  typeId: string
  typeName: string
  width?: number
  height?: number
  baseColor?: Vec3
}

/** Materialize a generated prototype ImageAsset (pure — no I/O). */
export function generatePrototypeSpriteAsset(
  options: GeneratePrototypeSpriteAssetOptions,
): ImageAsset {
  const typeId = options.typeId.trim()
  const typeName = options.typeName.trim() || typeId
  const width = options.width ?? PROTOTYPE_SPRITE_SIZE
  const height = options.height ?? PROTOTYPE_SPRITE_SIZE
  const hasExplicitColor = options.baseColor !== undefined
  const baseColor = options.baseColor ?? colorFromObjectTypeId(typeId)
  const id = prototypeAssetIdForType(typeId)
  const path = prototypeSpriteVirtualPath(id)
  return {
    id,
    name: `${typeName} (prototype)`,
    path,
    usage: 'sprite',
    source: 'generated',
    generated: {
      generator: 'prototype-sprite',
      width,
      height,
      temporary: true,
      shape: 'rectangle',
      baseColor: { ...baseColor },
      ownerTypeId: typeId,
      modified: hasExplicitColor,
    },
    dataUrl: generatePrototypeSpriteDataUrl(width, height, baseColor),
    defaultPivot: { x: 0.5, y: 0.5 },
  }
}

export function isGeneratedPrototypeAsset(asset: ImageAsset | undefined): boolean {
  if (!asset) return false
  if (asset.source === 'generated' && asset.generated?.generator === 'prototype-sprite') {
    return true
  }
  return asset.id.startsWith('gen_proto_')
    || asset.path.startsWith(GENERATED_PROTOTYPE_PATH_PREFIX)
}

/**
 * True when a generated prototype asset is the dedicated sprite for `typeId`
 * (stable id `gen_proto_{typeId}` and matching owner metadata).
 */
export function prototypeAssetMatchesType(
  asset: ImageAsset | undefined,
  typeId: string,
): boolean {
  if (!asset || !isGeneratedPrototypeAsset(asset)) return false
  const trimmed = typeId.trim()
  if (!trimmed) return false
  if (asset.id !== prototypeAssetIdForType(trimmed)) return false
  return prototypeOwnerTypeIdFromAsset(asset) === trimmed
}

/**
 * Canonical RGB for a generated prototype: user-edited color when modified,
 * otherwise the deterministic palette entry for the owning object type.
 */
export function resolvePrototypeBaseColor(
  asset: ImageAsset,
  fallbackTypeId?: string,
): Vec3 {
  const meta = asset.generated
  const ownerTypeId =
    prototypeOwnerTypeIdFromAsset(asset)
    || fallbackTypeId?.trim()
    || ''
  if (!meta) {
    return ownerTypeId ? colorFromObjectTypeId(ownerTypeId) : { x: 1, y: 1, z: 1 }
  }
  if (meta.modified) {
    return meta.baseColor
  }
  const resolved = ownerTypeId ? colorFromObjectTypeId(ownerTypeId) : meta.baseColor
  return resolved
}

/** Keep generated metadata, PNG bytes, and preview uploads in sync. */
export function syncGeneratedPrototypeAsset(
  asset: ImageAsset,
  fallbackTypeId?: string,
): ImageAsset {
  if (!isGeneratedPrototypeAsset(asset) || !asset.generated) return asset
  const meta = asset.generated
  const ownerTypeId =
    prototypeOwnerTypeIdFromAsset(asset)
    || fallbackTypeId?.trim()
    || ''
  const baseColor = resolvePrototypeBaseColor(asset, ownerTypeId || fallbackTypeId)
  const dataUrl = generatePrototypeSpriteDataUrl(meta.width, meta.height, baseColor)
  const sameColor = meta.baseColor.x === baseColor.x
    && meta.baseColor.y === baseColor.y
    && meta.baseColor.z === baseColor.z
  const sameOwner = !ownerTypeId || meta.ownerTypeId?.trim() === ownerTypeId
  if (sameColor && sameOwner && asset.dataUrl === dataUrl) return asset
  return {
    ...asset,
    generated: {
      ...meta,
      ...(ownerTypeId && !meta.ownerTypeId?.trim() ? { ownerTypeId } : {}),
      baseColor: { ...baseColor },
    },
    dataUrl,
  }
}

export type ObjectTypeAddAction = Extract<Action, { type: 'OBJECT_TYPE_ADD' }>

/**
 * Build a materialized OBJECT_TYPE_ADD action (prototype asset pre-generated).
 * Call site dispatches; reducer stays pure.
 */
export function buildObjectTypeAddAction(displayName: string): ObjectTypeAddAction {
  const trimmed = displayName.trim() || 'Object'
  const typeId = slugTypeId(trimmed)
  const prototypeAsset = generatePrototypeSpriteAsset({ typeId, typeName: trimmed })
  return {
    type: 'OBJECT_TYPE_ADD',
    typeId,
    displayName: trimmed,
    prototypeAsset,
  }
}

/** Collect sprite asset ids referenced by object types and materialized entities. */
export function collectReferencedSpriteAssetIds(project: ProjectDoc): Set<string> {
  const refs = new Set<string>()
  for (const type of Object.values(project.objectTypes ?? {})) {
    const ref = type.sprite.spriteAssetId?.trim()
    if (ref) refs.add(ref)
  }
  for (const ent of Object.values(project.entities ?? {})) {
    const ref = ent.sprite.spriteAssetId?.trim()
    if (ref) refs.add(ref)
  }
  return refs
}

/**
 * Remove unreferenced temporary generated prototype assets (e.g. after type delete).
 */
export function gcUnusedGeneratedPrototypeAssets(project: ProjectDoc): ProjectDoc {
  const refs = collectReferencedSpriteAssetIds(project)
  const assets = { ...(project.assets ?? {}) }
  let changed = false
  for (const [key, asset] of Object.entries(assets)) {
    if (!isGeneratedPrototypeAsset(asset)) continue
    if (!asset.generated?.temporary) continue
    if (refs.has(asset.id) || refs.has(key)) continue
    delete assets[key]
    changed = true
  }
  return changed ? { ...project, assets } : project
}

/**
 * Ensure an object type with no sprite ref gets a generated prototype asset (V3→V4).
 */
export function ensurePrototypeSpriteForObjectType(
  project: ProjectDoc,
  typeId: string,
  type: ObjectTypeDef,
): { project: ProjectDoc; changed: boolean } {
  const ref = type.sprite.spriteAssetId?.trim()
  if (ref) {
    const existing = project.assets?.[ref]
      ?? Object.values(project.assets ?? {}).find((a) => a.id === ref || a.path === ref)
    if (existing && !isGeneratedPrototypeAsset(existing)) {
      if (type.sprite.spriteAssetId === existing.id) {
        return { project, changed: false }
      }
      const objectTypes = {
        ...project.objectTypes!,
        [typeId]: {
          ...type,
          sprite: { ...type.sprite, spriteAssetId: existing.id, pivotFromAsset: true },
        },
      }
      return {
        project: { ...project, objectTypes },
        changed: true,
      }
    }
    if (existing && prototypeAssetMatchesType(existing, typeId)) {
      const synced = syncGeneratedPrototypeAsset(existing, typeId)
      const assets = { ...(project.assets ?? {}), [synced.id]: synced }
      const refFix = type.sprite.spriteAssetId !== synced.id
      const assetSync = synced !== existing
      if (!refFix && !assetSync) {
        return { project, changed: false }
      }
      return {
        project: {
          ...project,
          ...(refFix
            ? {
                objectTypes: {
                  ...project.objectTypes!,
                  [typeId]: {
                    ...type,
                    sprite: { ...type.sprite, spriteAssetId: synced.id, pivotFromAsset: true },
                  },
                },
              }
            : {}),
          assets,
        },
        changed: true,
      }
    }
  }

  // Prototype tint is palette-driven (ADR); legacy sprite.fillColor was a placeholder
  // rectangle tint and must not become the generated PNG baseColor on migration.
  const prototypeAsset = generatePrototypeSpriteAsset({
    typeId,
    typeName: type.displayName,
  })
  const objectTypes = {
    ...project.objectTypes!,
    [typeId]: {
      ...type,
      sprite: {
        ...type.sprite,
        spriteAssetId: prototypeAsset.id,
        pivotFromAsset: true,
      },
    },
  }
  const assets = { ...(project.assets ?? {}), [prototypeAsset.id]: prototypeAsset }
  return {
    project: { ...project, objectTypes, assets },
    changed: true,
  }
}

/** Decode a PNG (or other) data URL into raw bytes. */
export function assetBytesFromDataUrl(dataUrl: string): Uint8Array | null {
  try {
    const b64 = dataUrl.split(',')[1] ?? ''
    const bin = atob(b64)
    const u8 = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
    return u8
  } catch {
    return null
  }
}

/** Extract RGBA bytes from a prototype / generated image asset. */
export function prototypeAssetBytes(asset: ImageAsset): Uint8Array | null {
  if (!asset.dataUrl) return null
  return assetBytesFromDataUrl(asset.dataUrl)
}

/**
 * Build an imported ImageAsset from a promoted prototype (pure).
 * Keeps stable id, clips, image points, and pivot; drops generated metadata.
 */
export function buildPromotedPrototypeAsset(
  asset: ImageAsset,
  imported: ImportedAssetFile,
  displayName: string,
): ImageAsset {
  const label = displayName.trim() || asset.name.replace(/\s*\(prototype\)\s*$/i, '').trim() || asset.id
  const promoted: ImageAsset = {
    id: imported.id,
    name: label,
    path: imported.path,
    usage: asset.usage,
    source: 'imported',
    contentHash: imported.contentHash,
    ...(asset.defaultPivot ? { defaultPivot: { ...asset.defaultPivot } } : {}),
    ...(asset.clips?.length ? { clips: asset.clips } : {}),
    ...(asset.imagePoints?.length ? { imagePoints: asset.imagePoints } : {}),
    ...(asset.dataUrl ? { dataUrl: asset.dataUrl } : {}),
  }
  return promoted
}

/**
 * Restore a generated prototype to its factory rectangle (color, no Studio edits).
 */
export function resetPrototypeSpriteAsset(options: {
  asset: ImageAsset
  typeId: string
  typeName: string
}): ImageAsset {
  const { asset, typeId, typeName } = options
  if (!isGeneratedPrototypeAsset(asset)) return asset
  const fresh = generatePrototypeSpriteAsset({
    typeId,
    typeName,
  })
  return {
    ...fresh,
    id: asset.id,
    path: asset.path,
  }
}

/**
 * Write prototype bytes to a real project image path and return the promoted asset.
 */
export async function promotePrototypeAssetToImported(options: {
  asset: ImageAsset
  projectRoot: string | null
  displayName: string
}): Promise<ImageAsset> {
  const { asset, projectRoot, displayName } = options
  if (!isGeneratedPrototypeAsset(asset)) {
    throw new Error('Only generated prototype sprites can be promoted.')
  }
  const bytes = prototypeAssetBytes(asset)
  if (!bytes || bytes.length === 0) {
    throw new Error('Prototype sprite has no image data to promote.')
  }
  const safeLabel = displayName.trim().replace(/[^A-Za-z0-9._-]+/g, '_') || 'sprite'
  const imported = await importAssetFile({
    kind: 'image',
    fileName: `${safeLabel}.png`,
    bytes,
    projectRoot,
    id: asset.id,
  })
  return buildPromotedPrototypeAsset(asset, imported, displayName)
}

export function patchPrototypeSpriteColor(asset: ImageAsset, baseColor: Vec3): ImageAsset {
  if (!isGeneratedPrototypeAsset(asset) || !asset.generated) return asset
  const width = asset.generated.width
  const height = asset.generated.height
  return {
    ...asset,
    generated: {
      ...asset.generated,
      baseColor: { ...baseColor },
      modified: true,
    },
    dataUrl: generatePrototypeSpriteDataUrl(width, height, baseColor),
  }
}

export function hydrateGeneratedAssetDataUrls(project: ProjectDoc): ProjectDoc {
  const assets = { ...(project.assets ?? {}) }
  let changed = false
  for (const [key, asset] of Object.entries(assets)) {
    if (!isGeneratedPrototypeAsset(asset)) continue
    const synced = syncGeneratedPrototypeAsset(
      asset,
      prototypeOwnerTypeIdFromAsset(asset),
    )
    if (synced === asset) continue
    assets[key] = synced
    changed = true
  }
  return changed ? { ...project, assets } : project
}

export function generatedAssetBytesFromProject(
  project: ProjectDoc,
  relPath: string,
): Uint8Array | null {
  const trimmed = relPath.trim()
  if (!trimmed.startsWith(GENERATED_PROTOTYPE_PATH_PREFIX)) return null
  const asset = Object.values(project.assets ?? {}).find((a) => a.path === trimmed)
  if (!asset?.dataUrl) return null
  return assetBytesFromDataUrl(asset.dataUrl)
}

/**
 * Ensure every object type owns `gen_proto_{typeId}` (repairs shared / legacy refs).
 */
export function rebindAllObjectTypePrototypeSprites(project: ProjectDoc): {
  project: ProjectDoc
  changed: boolean
} {
  if (!project.objectTypes || Object.keys(project.objectTypes).length === 0) {
    return { project, changed: false }
  }
  let next = project
  let changed = false
  for (const [typeId, type] of Object.entries(project.objectTypes)) {
    const result = ensurePrototypeSpriteForObjectType(next, typeId, type)
    if (result.changed) {
      next = result.project
      changed = true
    }
  }
  return { project: next, changed }
}

export function migrateProjectToPrototypeSprites(project: ProjectDoc): {
  project: ProjectDoc
  changed: boolean
} {
  return rebindAllObjectTypePrototypeSprites(project)
}

/** Clear clip spawn fields after prototype reset or promote-side effects. */
export function clearSpriteClipFields(sprite: SpriteComponent): SpriteComponent {
  return {
    ...sprite,
    defaultClip: undefined,
    playClipOnSpawn: false,
    pivotFromAsset: true,
  }
}

/**
 * Patch every object type sprite that references `assetId`.
 * @returns affected object type ids (for rematerialize).
 */
export function patchObjectTypeSpritesUsingAsset(
  project: ProjectDoc,
  assetId: string,
  patch: (sprite: SpriteComponent) => SpriteComponent,
): { project: ProjectDoc; typeIds: string[] } {
  if (!project.objectTypes) return { project, typeIds: [] }
  const objectTypes = { ...project.objectTypes }
  const typeIds: string[] = []
  for (const [typeId, type] of Object.entries(objectTypes)) {
    if (type.sprite.spriteAssetId !== assetId) continue
    objectTypes[typeId] = { ...type, sprite: patch(type.sprite) }
    typeIds.push(typeId)
  }
  return { project: { ...project, objectTypes }, typeIds }
}

/** True when reset would discard user-authored prototype data. */
export function prototypeHasUserEdits(
  project: ProjectDoc,
  asset: ImageAsset,
): boolean {
  if (!isGeneratedPrototypeAsset(asset)) return false
  if (asset.generated?.modified) return true
  if ((asset.clips?.length ?? 0) > 0) return true
  if ((asset.imagePoints?.length ?? 0) > 0) return true
  if (project.collisionProfiles?.[asset.id]) return true
  return false
}
