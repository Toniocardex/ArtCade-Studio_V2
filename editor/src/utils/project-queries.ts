import type { ProjectDoc, EntityDef, SceneDef } from '../types'
import type { LogicBoard } from '../types/logic-board'
import { logicBoardCompilerLabel } from './logic-board/labels'
import { effectiveTypeId } from './project-object-types'

const compareLocale = (a: string, b: string): number => a.localeCompare(b)

/** True when the entity id is listed on the given scene. */
export function isEntityInScene(
  project: ProjectDoc,
  sceneId: string,
  entityId: number,
): boolean {
  return project.scenes?.[sceneId]?.entityIds.includes(entityId) ?? false
}

/** Entities that belong to a given scene, in entityIds order. */
export function getEntitiesInScene(project: ProjectDoc, sceneId: string): EntityDef[] {
  const scene = project.scenes?.[sceneId]
  if (!scene) return []
  return scene.entityIds
    .map(id => project.entities?.[id])
    .filter((e): e is EntityDef => Boolean(e))
}

/** Active scene, falling back to the first scene available. */
export function getActiveScene(project: ProjectDoc, sceneId?: string | null): SceneDef | undefined {
  return project.scenes?.[sceneId ?? project.activeSceneId]
    ?? Object.values(project.scenes ?? {})[0]
}

/** Human-readable label: "Hero (Player)" */
export function entityLabel(entity: EntityDef): string {
  return entity.name === entity.className
    ? entity.name
    : `${entity.name} (${entity.className})`
}

/** Entities that share a class (runtime pool / logic board target). */
export function entitiesByClass(project: ProjectDoc, className: string): EntityDef[] {
  return Object.values(project.entities)
    .filter((e) => e.className === className)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getObjectType(
  project: ProjectDoc,
  objectTypeId: string,
) {
  return project.objectTypes?.[objectTypeId]
}

const CLASS_LABEL_MAX = 56

/**
 * Logic Board / picker label: shows scene entity names for a class.
 * e.g. "Enemy — Patrol_A, Patrol_B" or "Hero (Player)" when alone.
 */
export function objectTypeDisplayLabel(
  project: ProjectDoc | null | undefined,
  objectTypeId: string,
): string {
  const t = project?.objectTypes?.[objectTypeId]
  if (t) return t.displayName || objectTypeId
  return classDisplayLabel(project, objectTypeId)
}

export function classDisplayLabel(
  project: ProjectDoc | null | undefined,
  className: string,
): string {
  if (!className) return '…'
  if (!project) return className
  const typeDef = project.objectTypes?.[className]
  if (typeDef) return typeDef.displayName
  const ents = entitiesByClass(project, className)
  if (ents.length === 0) return className
  if (ents.length === 1) return entityLabel(ents[0])
  const names = ents.map((e) => e.name).join(', ')
  const suffix = names.length <= CLASS_LABEL_MAX - className.length - 3
    ? names
    : `${names.slice(0, CLASS_LABEL_MAX - className.length - 6)}…`
  return `${className} — ${suffix}`
}

/** Label for a specific entity id (logic board target entity_id). */
export function entityIdDisplayLabel(
  project: ProjectDoc | null | undefined,
  entityId: number,
): string {
  if (!project) return `Object #${entityId}`
  const e = project.entities?.[entityId]
  return e?.name ?? `Object #${entityId}`
}

/** Object-type key on a rulesheet target (undefined for global/scene). */
export function logicBoardTargetTypeKey(
  target: LogicBoard['target'],
): string | undefined {
  if (target.type === 'object_type') return target.objectTypeId
  return undefined
}

function logicBoardSharedTypeId(board: LogicBoard): string | undefined {
  return logicBoardTargetTypeKey(board.target)
}

function collectInstanceIdsForType(project: ProjectDoc, typeId: string): number[] {
  const ids: number[] = []
  for (const scene of Object.values(project.scenes ?? {})) {
    for (const inst of scene.instances ?? []) {
      if (inst.objectTypeId === typeId) ids.push(inst.id)
    }
  }
  return ids
}

function entityMatchesSharedType(ent: EntityDef, typeId: string): boolean {
  return ent.className === typeId || effectiveTypeId(ent) === typeId
}

function projectEntities(project: ProjectDoc): Record<number, EntityDef> {
  return project.entities ?? {}
}

function collectLegacyEntityIdsForType(project: ProjectDoc, typeId: string): number[] {
  return Object.values(projectEntities(project))
    .filter((ent) => entityMatchesSharedType(ent, typeId))
    .map((ent) => ent.id)
}

/**
 * Class string used by the runtime for pool/lifecycle (`pool.getAll`, onSpawn).
 * When the board targets a legacy instance slug (e.g. Entity_1) but className is
 * still "Entity", returns the real className so compiled Lua matches C++.
 */
export function logicBoardRuntimeClassKey(
  project: ProjectDoc,
  board: LogicBoard,
): string | undefined {
  const ids = logicBoardTargetEntityIds(project, board)
  if (ids.length > 0) {
    const ent = projectEntities(project)[ids[0]]
    if (ent?.className) return ent.className
  }
  return logicBoardSharedTypeId(board)
}

/**
 * Entity ids that a rulesheet's target refers to (`self` pool).
 * Matches scene instances by objectTypeId and legacy flat entities by className
 * or effectiveTypeId (e.g. Entity_1 named instance with className "Entity").
 */
export function logicBoardTargetEntityIds(
  project: ProjectDoc,
  board: LogicBoard,
): number[] {
  const typeId = logicBoardSharedTypeId(board)
  if (!typeId) return []

  const ids = new Set<number>()
  for (const id of collectInstanceIdsForType(project, typeId)) ids.add(id)
  for (const id of collectLegacyEntityIdsForType(project, typeId)) ids.add(id)
  return [...ids]
}

/** Display name for a rulesheet in dropdowns and headers. */
export function logicBoardLabel(
  _project: ProjectDoc | null | undefined,
  board: LogicBoard,
): string {
  return logicBoardCompilerLabel(board)
}

/**
 * Human-readable label for which scene objects a rulesheet affects (Logic Board cards).
 */
export function rulesheetAppliesToLabel(
  project: ProjectDoc | null | undefined,
  board: LogicBoard,
): string {
  if (!project) return 'Unknown'
  const target = board.target
  if (target.type === 'global') return 'Global'
  if (target.type === 'scene') return 'Scene'
  const typeKey = logicBoardTargetTypeKey(target)
  const ids = logicBoardTargetEntityIds(project, board)
  if (ids.length === 1) {
    const name = projectEntities(project)[ids[0]]?.name?.trim()
    return name || `Object #${ids[0]}`
  }
  if (ids.length > 1) {
    const names = ids
      .map((id) => projectEntities(project)[id]?.name?.trim() || `#${id}`)
      .slice(0, 3)
    const more = ids.length - names.length
    const prefix = typeKey ? `${typeKey}: ` : ''
    return more > 0 ? `${prefix}${names.join(', ')} +${more}` : `${prefix}${names.join(', ')}`
  }
  if (typeKey) return `Type ${typeKey} (no instances in scene)`
  return 'No target'
}

/** Rulesheets that apply to at least one entity in the given scene. */
export function logicBoardsForScene(
  project: ProjectDoc | null | undefined,
  sceneId: string,
): LogicBoard[] {
  if (!project?.logicBoards?.length) return []
  const sceneEntityIds = new Set(
    getEntitiesInScene(project, sceneId).map((e) => e.id),
  )
  return project.logicBoards.filter((board) => {
    if (board.target.type === 'global' || board.target.type === 'scene') return true
    return logicBoardTargetEntityIds(project, board).some((id) =>
      sceneEntityIds.has(id),
    )
  })
}

/** All unique class names across all entities in the project. */
export function allClassNames(project: ProjectDoc): string[] {
  const fromTypes = Object.keys(project.objectTypes ?? {})
  if (fromTypes.length > 0) return fromTypes.sort(compareLocale)
  return [...new Set(Object.values(project.entities).map((e) => e.className))].sort(compareLocale)
}

/** Logic board bound to an object type (preferred). */
export function findLogicBoardForObjectType(
  project: ProjectDoc | null | undefined,
  objectTypeId: string,
): LogicBoard | undefined {
  if (!project?.logicBoards) return undefined
  return project.logicBoards.find(
    (b) =>
      b.target.type === 'object_type' && b.target.objectTypeId === objectTypeId,
  )
}

/** Resolve board for a scene instance via its object type (no per-instance boards). */
export function findLogicBoardForInstance(
  project: ProjectDoc | null | undefined,
  instanceId: number,
): LogicBoard | undefined {
  if (!project) return undefined
  const typeId =
    project.scenes?.[project.activeSceneId]?.instances?.find((i) => i.id === instanceId)
      ?.objectTypeId
    ?? project.entities?.[instanceId]?.className
  if (!typeId) return undefined
  return findLogicBoardForObjectType(project, typeId)
}

/** Tags used in the project. */
export function allEntityTags(project: ProjectDoc): string[] {
  const set = new Set<string>()
  for (const e of Object.values(project.entities)) {
    for (const t of e.tags ?? []) {
      if (t) set.add(t)
    }
  }
  return [...set].sort(compareLocale)
}
