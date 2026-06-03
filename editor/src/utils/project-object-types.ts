// ---------------------------------------------------------------------------
// Object Types (v2) — materialize, migrate legacy entities, export for save
// ---------------------------------------------------------------------------

import type {
  EntityDef,
  ObjectTypeDef,
  ProjectDoc,
  SceneDef,
  SceneInstanceDef,
  Transform,
} from '../types'
import type { LogicBoard } from '../types/logic-board'
import { COMPONENT_KEYS } from '../types/components'
import { createEntityDef } from './project-builders'
import { resolveEntitiesForRuntime } from './sprite-pivot-resolve'

export const PROJECT_FORMAT_V2 = 2

const GENERIC_CLASS = new Set(['Entity', 'Unknown', ''])

/** Editor-only flag after legacy import (not persisted). */
export type ProjectLoadMeta = {
  migratedFromLegacy?: boolean
}

export function effectiveTypeId(entity: EntityDef): string {
  const cn = entity.className?.trim() ?? ''
  if (cn && !GENERIC_CLASS.has(cn)) return cn
  return slugTypeId(entity.name || `Object_${entity.id}`)
}

export function slugTypeId(name: string): string {
  const base = name
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!base) return 'Object'
  return base.charAt(0).toUpperCase() + base.slice(1)
}

function cloneTransform(t: Transform): Transform {
  return {
    position: { x: t.position.x, y: t.position.y },
    scale: { x: t.scale.x, y: t.scale.y },
    rotation: t.rotation,
    ...(t.velocity ? { velocity: { ...t.velocity } } : {}),
  }
}

/** Strip placement fields from an entity → object type prototype. */
export function entityToObjectType(entity: EntityDef, typeId: string): ObjectTypeDef {
  const base: ObjectTypeDef = {
    id: typeId,
    displayName: entity.name || typeId,
    tags: [...(entity.tags ?? [])],
    sprite: {
      ...entity.sprite,
      tint: { ...entity.sprite.tint },
      fillColor: { ...entity.sprite.fillColor },
      pivot: { ...entity.sprite.pivot },
      ...(entity.sprite.pivotFromAsset === false ? { pivotFromAsset: false } : {}),
      ...(entity.sprite.defaultClip ? { defaultClip: entity.sprite.defaultClip } : {}),
      ...(entity.sprite.playClipOnSpawn === true ? { playClipOnSpawn: true } : {}),
    },
    ...(entity.animation ? { animation: { ...entity.animation } } : {}),
    ...(entity.physics ? { physics: JSON.parse(JSON.stringify(entity.physics)) } : {}),
    ...(entity.scriptPath ? { scriptPath: entity.scriptPath } : {}),
    ...(entity.visible === false ? { visible: false } : {}),
  }
  for (const key of COMPONENT_KEYS) {
    const v = (entity as unknown as Record<string, unknown>)[key]
    if (v && typeof v === 'object') {
      (base as unknown as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(v))
    }
  }
  return base
}

export function materializeEntity(
  type: ObjectTypeDef,
  instance: SceneInstanceDef,
): EntityDef {
  const xf = cloneTransform(instance.transform)
  const ent = createEntityDef(
    instance.id,
    instance.instanceName ?? type.displayName,
    type.id,
    xf.position,
  )
  ent.transform = xf
  ent.tags = [...type.tags]
  ent.sprite = {
    ...type.sprite,
    tint: { ...type.sprite.tint },
    fillColor: { ...type.sprite.fillColor },
    pivot: { ...type.sprite.pivot },
    ...(type.sprite.defaultClip ? { defaultClip: type.sprite.defaultClip } : {}),
    ...(type.sprite.playClipOnSpawn === true ? { playClipOnSpawn: true } : {}),
  }
  if (type.animation) ent.animation = { ...type.animation }
  if (type.physics) ent.physics = JSON.parse(JSON.stringify(type.physics))
  if (type.scriptPath) ent.scriptPath = type.scriptPath
  ent.visible = instance.visible ?? type.visible ?? true
  for (const key of COMPONENT_KEYS) {
    const v = (type as unknown as Record<string, unknown>)[key]
    if (v && typeof v === 'object') {
      (ent as unknown as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(v))
    }
  }
  return ent
}

export function materializeAllEntities(project: ProjectDoc): Record<number, EntityDef> {
  const out: Record<number, EntityDef> = {}
  const types = project.objectTypes ?? {}
  for (const scene of Object.values(project.scenes)) {
    for (const inst of scene.instances ?? []) {
      const type = types[inst.objectTypeId]
      if (!type) continue
      out[inst.id] = materializeEntity(type, inst)
    }
  }
  return out
}

/**
 * Authoritative entity map for WASM sync / runtime fingerprint.
 * With object types, materialize instances from type+placement, then overlay
 * `project.entities` (Inspector overrides: pivot, tint, components, …).
 */
export function entitiesForRuntimeSync(project: ProjectDoc): Record<number, EntityDef> {
  const hasObjectTypes =
    project.objectTypes != null && Object.keys(project.objectTypes).length > 0
  const merged = hasObjectTypes
    ? (() => {
        const out = materializeAllEntities(project)
        for (const ent of Object.values(project.entities)) {
          out[ent.id] = ent
        }
        return out
      })()
    : project.entities

  return resolveEntitiesForRuntime(merged, project.assets)
}

function syncSceneEntityIds(scene: SceneDef): void {
  scene.entityIds = (scene.instances ?? []).map((i) => i.id)
}

function syncAllSceneEntityIds(project: ProjectDoc): void {
  for (const scene of Object.values(project.scenes)) {
    syncSceneEntityIds(scene)
  }
}

function uniqueTypeId(base: string, used: Set<string>): string {
  let id = base
  let n = 2
  while (used.has(id)) {
    id = `${base}_${n}`
    n++
  }
  used.add(id)
  return id
}

/** Build objectTypes + instances from flat entities (export on save / legacy import). */
export function buildObjectModelFromEntities(project: ProjectDoc): {
  objectTypes: Record<string, ObjectTypeDef>
  scenes: Record<string, SceneDef>
} {
  const usedTypeIds = new Set<string>()
  const entityToTypeId = new Map<number, string>()
  const typePrototypes = new Map<string, EntityDef>()
  const baseToTypeId = new Map<string, string>()

  for (const ent of Object.values(project.entities)) {
    const baseId = effectiveTypeId(ent)
    if (!baseToTypeId.has(baseId)) {
      baseToTypeId.set(baseId, uniqueTypeId(baseId, usedTypeIds))
    }
    const typeId = baseToTypeId.get(baseId)!
    entityToTypeId.set(ent.id, typeId)
    if (!typePrototypes.has(typeId)) typePrototypes.set(typeId, ent)
  }

  const objectTypes: Record<string, ObjectTypeDef> = {}
  for (const [typeId, proto] of typePrototypes) {
    objectTypes[typeId] = entityToObjectType(proto, typeId)
  }

  const scenes: Record<string, SceneDef> = {}
  for (const [sid, scene] of Object.entries(project.scenes)) {
    const instances: SceneInstanceDef[] = []
    for (const eid of scene.entityIds) {
      const ent = project.entities[eid]
      const typeId = entityToTypeId.get(eid)
      if (!ent || !typeId) continue
      instances.push({
        id: ent.id,
        objectTypeId: typeId,
        instanceName: ent.name !== objectTypes[typeId]?.displayName ? ent.name : undefined,
        transform: cloneTransform(ent.transform),
        ...(ent.visible === false ? { visible: false } : {}),
      })
    }
    scenes[sid] = { ...scene, instances, entityIds: instances.map((i) => i.id) }
  }

  return { objectTypes, scenes }
}

/**
 * Keep `objectTypes` and scene `instances` aligned with flat `entities` during editing.
 * Preserves `project.entities` as the inspector authoring source (no rematerialize pass).
 */
export function syncObjectModelFromEntities(project: ProjectDoc): ProjectDoc {
  const { objectTypes, scenes } = buildObjectModelFromEntities(project)
  return {
    ...project,
    formatVersion: PROJECT_FORMAT_V2,
    objectTypes,
    scenes,
  }
}

function migrateLogicBoards(
  boards: LogicBoard[] | undefined,
  entityToType: Map<number, string>,
): LogicBoard[] | undefined {
  if (!boards?.length) return boards
  return boards.map((board) => {
    const t = board.target
    if (t.type === 'entity_id' && t.entityId != null) {
      const typeId = entityToType.get(t.entityId)
      if (typeId) {
        return {
          ...board,
          target: { type: 'object_type' as const, objectTypeId: typeId },
        }
      }
    }
    if (t.type === 'entity_class' && t.className) {
      return {
        ...board,
        target: { type: 'object_type' as const, objectTypeId: t.className },
      }
    }
    return board
  })
}

export function migrateLegacyProject(project: ProjectDoc): ProjectDoc {
  const { objectTypes, scenes } = buildObjectModelFromEntities(project)
  const entityToType = new Map<number, string>()
  for (const scene of Object.values(scenes)) {
    for (const inst of scene.instances ?? []) {
      entityToType.set(inst.id, inst.objectTypeId)
    }
  }
  const withModel = { ...project, objectTypes, scenes, formatVersion: PROJECT_FORMAT_V2 }
  const entities = materializeAllEntities(withModel)
  return {
    ...project,
    formatVersion: PROJECT_FORMAT_V2,
    objectTypes,
    scenes,
    entities,
    logicBoards: migrateLogicBoards(project.logicBoards, entityToType),
  }
}

export function isV2ObjectModel(project: ProjectDoc): boolean {
  return (
    project.formatVersion === PROJECT_FORMAT_V2
    && project.objectTypes != null
    && Object.keys(project.objectTypes).length > 0
    && Object.values(project.scenes).some((s) => (s.instances?.length ?? 0) > 0)
  )
}

/** Normalize after parse: ensure v2 fields + materialized entities cache. */
export function normalizeProjectDoc(project: ProjectDoc): {
  project: ProjectDoc
  migratedFromLegacy: boolean
} {
  if (isV2ObjectModel(project)) {
    const entities = materializeAllEntities(project)
    syncAllSceneEntityIds(project)
    return { project: { ...project, entities }, migratedFromLegacy: false }
  }
  const migrated = migrateLegacyProject(project)
  return { project: migrated, migratedFromLegacy: true }
}

/** Prepare project for JSON save (v2 only on disk). */
export function projectForSave(project: ProjectDoc): ProjectDoc {
  const { objectTypes, scenes } = buildObjectModelFromEntities(project)
  return {
    ...project,
    formatVersion: PROJECT_FORMAT_V2,
    objectTypes,
    scenes,
  }
}

export function allObjectTypeIds(project: ProjectDoc | null | undefined): string[] {
  if (!project) return []
  return Object.keys(project.objectTypes ?? {}).sort()
}

export function findObjectTypeForInstance(
  project: ProjectDoc,
  instanceId: number,
): string | null {
  for (const scene of Object.values(project.scenes)) {
    const inst = scene.instances?.find((i) => i.id === instanceId)
    if (inst) return inst.objectTypeId
  }
  const ent = project.entities[instanceId]
  return ent ? effectiveTypeId(ent) : null
}
