// ---------------------------------------------------------------------------
// entity-retype — prematerialized retype / variant creation (prototype ownership)
// ---------------------------------------------------------------------------

import type { ImageAsset, ObjectTypeDef, ProjectDoc, SpriteComponent } from '../types'
import { findSceneInstance, slugTypeId } from './project-object-types'
import { imageAssetForRef } from './sprite-asset-ref'
import {
  generatePrototypeSpriteAsset,
  isGeneratedPrototypeAsset,
  prototypeAssetIdForType,
  prototypeOwnerTypeIdFromAsset,
  syncGeneratedPrototypeAsset,
} from './prototype-sprite'

export type EntityRetypeAction = {
  type: 'ENTITY_RETYPE'
  entityId: number
  targetTypeId: string
  targetDisplayName: string
  newObjectType?: ObjectTypeDef
  prototypeAsset?: ImageAsset
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Throws when a generated prototype on `typeId` does not own `gen_proto_{typeId}`.
 * Used in tests; production load path repairs via `normalizePrototypeSprites`.
 */
export function assertPrototypeOwnership(project: ProjectDoc, typeId: string): void {
  const type = project.objectTypes?.[typeId]
  const ref = type?.sprite.spriteAssetId?.trim()
  if (!ref) return

  const asset = imageAssetForRef(project, ref)
  if (!isGeneratedPrototypeAsset(asset)) return

  const expectedId = prototypeAssetIdForType(typeId)
  const owner = prototypeOwnerTypeIdFromAsset(asset!)
  if (asset!.id !== expectedId || owner !== typeId) {
    throw new Error(`Prototype ownership violation for ${typeId}`)
  }
}

/**
 * Build an atomic ENTITY_RETYPE action: retarget to an existing type, or create
 * a variant type (with a dedicated generated prototype when the source uses one).
 */
export function buildEntityRetypeAction(
  project: ProjectDoc,
  entityId: number,
  className: string,
): EntityRetypeAction | null {
  const trimmed = className.trim()
  if (!trimmed) return null

  const found = findSceneInstance(project, entityId)
  if (!found) return null

  const sourceTypeId = found.instance.objectTypeId
  const sourceType = project.objectTypes?.[sourceTypeId]
  if (!sourceType) return null

  const targetTypeId = slugTypeId(trimmed)
  if (targetTypeId === sourceTypeId) return null

  const existingTarget = project.objectTypes?.[targetTypeId]
  if (existingTarget) {
    return {
      type: 'ENTITY_RETYPE',
      entityId,
      targetTypeId,
      targetDisplayName: existingTarget.displayName,
    }
  }

  const sourceRef = sourceType.sprite.spriteAssetId?.trim()
  const sourceAsset = sourceRef ? imageAssetForRef(project, sourceRef) : undefined

  let prototypeAsset: ImageAsset | undefined
  let sprite: SpriteComponent = cloneJson(sourceType.sprite)

  if (isGeneratedPrototypeAsset(sourceAsset)) {
    prototypeAsset = syncGeneratedPrototypeAsset(
      generatePrototypeSpriteAsset({
        typeId: targetTypeId,
        typeName: trimmed,
      }),
      targetTypeId,
    )
    sprite = {
      ...sprite,
      spriteAssetId: prototypeAsset.id,
      fillColor: { ...prototypeAsset.generated!.baseColor },
      pivotFromAsset: true,
    }
  }

  const newObjectType: ObjectTypeDef = {
    ...cloneJson(sourceType),
    id: targetTypeId,
    displayName: trimmed,
    sprite,
  }

  return {
    type: 'ENTITY_RETYPE',
    entityId,
    targetTypeId,
    targetDisplayName: trimmed,
    newObjectType,
    prototypeAsset,
  }
}
