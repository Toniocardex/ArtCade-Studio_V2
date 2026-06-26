// ---------------------------------------------------------------------------
// object-create — authoritative atomic object type + instance creation
// ---------------------------------------------------------------------------

import type {
  ImageAsset,
  ObjectTypeDef,
  ProjectDoc,
  SceneInstanceDef,
  Vec2,
  Vec3,
} from '../types'
import { createEntityDef, nextEntityId } from './project-builders'
import { entityToObjectType, slugTypeId } from './project-object-types'
import {
  generatePrototypeSpriteAsset,
  syncGeneratedPrototypeAsset,
} from './prototype-sprite'
import { spriteAssignedFromAsset } from './sprite-pivot-resolve'

export type CreateObjectInput = {
  project: ProjectDoc
  sceneId: string
  displayName: string
  color?: Vec3
  position?: Vec2
}

export type CreateObjectError =
  | 'invalid-name'
  | 'duplicate-name'
  | 'duplicate-type-id'
  | 'scene-not-found'

export type ObjectCreateAction = {
  type: 'OBJECT_CREATE'
  sceneId: string
  objectType: ObjectTypeDef
  prototypeAsset: ImageAsset
  instance: SceneInstanceDef
}

export type CreateObjectResult =
  | { ok: true; action: ObjectCreateAction }
  | { ok: false; error: CreateObjectError }

/**
 * Returns a validation error when a new object type cannot use `displayName`.
 * @param exceptObjectTypeId optional type id to ignore (rename flows)
 */
export function objectTypeCreateBlocked(
  project: ProjectDoc,
  displayName: string,
  exceptObjectTypeId?: string,
): CreateObjectError | null {
  const name = displayName.trim()
  if (!name) return 'invalid-name'

  const wantedName = name.toLocaleLowerCase()
  const wantedId = slugTypeId(name).toLocaleLowerCase()
  const typeId = slugTypeId(name)

  for (const type of Object.values(project.objectTypes ?? {})) {
    if (exceptObjectTypeId && type.id === exceptObjectTypeId) continue
    if (type.displayName.trim().toLocaleLowerCase() === wantedName) {
      return 'duplicate-name'
    }
    if (type.id.toLocaleLowerCase() === wantedId) {
      return 'duplicate-type-id'
    }
  }

  if (project.objectTypes?.[typeId] && typeId !== exceptObjectTypeId) {
    return 'duplicate-type-id'
  }

  return null
}

/**
 * Materialize a new object type with a prototype sprite assigned.
 */
export function createDefaultObjectType(options: {
  typeId: string
  displayName: string
  prototypeAsset: ImageAsset
}): ObjectTypeDef {
  const synced = syncGeneratedPrototypeAsset(options.prototypeAsset, options.typeId)
  const base = createEntityDef(0, options.displayName, options.typeId)
  return entityToObjectType(
    {
      ...base,
      sprite: spriteAssignedFromAsset(base.sprite, synced),
    },
    options.typeId,
  )
}

/**
 * Build an atomic OBJECT_CREATE action: validates uniqueness, generates prototype,
 * object type, and scene instance in one prematerialized payload.
 */
export function buildCreateObjectAction(input: CreateObjectInput): CreateObjectResult {
  const {
    project,
    sceneId,
    displayName,
    color,
    position = { x: 0, y: 0 },
  } = input

  const name = displayName.trim()
  const blocked = objectTypeCreateBlocked(project, name)
  if (blocked) {
    return { ok: false, error: blocked }
  }

  const scene = project.scenes?.[sceneId]
  if (!scene) {
    return { ok: false, error: 'scene-not-found' }
  }

  const typeId = slugTypeId(name)

  const prototypeAsset = syncGeneratedPrototypeAsset(
    generatePrototypeSpriteAsset({
      typeId,
      typeName: name,
      ...(color ? { baseColor: color } : {}),
    }),
    typeId,
  )

  const objectType = createDefaultObjectType({
    typeId,
    displayName: name,
    prototypeAsset,
  })

  const instanceId = nextEntityId(project)

  const instance: SceneInstanceDef = {
    id: instanceId,
    objectTypeId: typeId,
    transform: {
      position: { ...position },
      scale: { x: 1, y: 1 },
      rotation: 0,
    },
  }

  return {
    ok: true,
    action: {
      type: 'OBJECT_CREATE',
      sceneId,
      objectType,
      prototypeAsset,
      instance,
    },
  }
}

/** User-facing message for a create-object validation error. */
export function createObjectErrorMessage(error: CreateObjectError, displayName?: string): string {
  switch (error) {
    case 'invalid-name':
      return 'Object name cannot be empty.'
    case 'duplicate-name':
      return `An object type named "${displayName?.trim() || 'this name'}" already exists.\n\nUse "Add instance" on that object type, or choose a different name.`
    case 'duplicate-type-id':
      return `The name "${displayName?.trim() || 'this name'}" normalizes to an object type id that already exists (e.g. "Enemy Boss" vs "Enemy-Boss").\n\nChoose a different name.`
    case 'scene-not-found':
      return 'The active scene could not be found.'
  }
}
