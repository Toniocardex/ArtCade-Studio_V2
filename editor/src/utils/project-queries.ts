import type { ProjectDoc, EntityDef, SceneDef } from '../types'
import type { LogicBoard } from '../types/logic-board'

/** Entities that belong to a given scene, in entityIds order. */
export function getEntitiesInScene(project: ProjectDoc, sceneId: string): EntityDef[] {
  const scene = project.scenes[sceneId]
  if (!scene) return []
  return scene.entityIds
    .map(id => project.entities[id])
    .filter((e): e is EntityDef => Boolean(e))
}

/** Active scene, falling back to the first scene available. */
export function getActiveScene(project: ProjectDoc, sceneId?: string | null): SceneDef | undefined {
  return project.scenes[sceneId ?? project.activeSceneId]
    ?? Object.values(project.scenes)[0]
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

const CLASS_LABEL_MAX = 56

/**
 * Logic Board / picker label: shows scene entity names for a class.
 * e.g. "Enemy — Patrol_A, Patrol_B" or "Hero (Player)" when alone.
 */
export function classDisplayLabel(
  project: ProjectDoc | null | undefined,
  className: string,
): string {
  if (!className) return '…'
  if (!project) return className
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
  const e = project.entities[entityId]
  return e?.name ?? `Object #${entityId}`
}

/** Rulesheet bound to one entity instance. */
export function findLogicBoardForEntity(
  project: ProjectDoc | null | undefined,
  entityId: number,
): LogicBoard | undefined {
  if (!project?.logicBoards) return undefined
  return project.logicBoards.find(
    (b) => b.target.type === 'entity_id' && b.target.entityId === entityId,
  )
}

/** Display name for a rulesheet in dropdowns and headers. */
export function logicBoardLabel(
  project: ProjectDoc | null | undefined,
  board: LogicBoard,
): string {
  if (board.target.type === 'entity_id' && board.target.entityId != null) {
    return entityIdDisplayLabel(project, board.target.entityId)
  }
  if (board.target.type === 'entity_class' && board.target.className) {
    return `[class] ${classDisplayLabel(project, board.target.className)}`
  }
  if (board.target.type === 'scene') return 'Scene'
  const short = board.boardId.replace(/^board_/, '').slice(0, 12)
  return short || 'Rules'
}

/** All unique class names across all entities in the project. */
export function allClassNames(project: ProjectDoc): string[] {
  return [...new Set(Object.values(project.entities).map(e => e.className))].sort()
}

/** Tags used in the project: entity.tags plus SensorComponent.targetTag values. */
export function allEntityTags(project: ProjectDoc): string[] {
  const set = new Set<string>()
  for (const e of Object.values(project.entities)) {
    for (const t of e.tags ?? []) {
      if (t) set.add(t)
    }
    const sensor = e.sensor as { targetTag?: string } | undefined
    if (sensor?.targetTag) set.add(sensor.targetTag)
  }
  return [...set].sort()
}
