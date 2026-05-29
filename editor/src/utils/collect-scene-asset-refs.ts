// ---------------------------------------------------------------------------
// collect-scene-asset-refs — static closure over ProjectDoc for scene textures
// See docs/ASSET_PIPELINE_ARCHITECTURE.md §5.1
// ---------------------------------------------------------------------------

import type { EntityDef, ProjectDoc } from '../types'
import type { LogicAction, LogicBoard } from '../types/logic-board'
import { materializeEntity } from './project-object-types'

/** v1: project-relative path used as TextureCache key (same as spriteAssetId today). */
export type SceneAssetLoadKey = string

export interface CollectSceneAssetRefsOptions {
  /**
   * scene-static (default): placed instances + tilemap in this scene only.
   * scene+spawn-prototypes: above + sprites for types referenced by static
   *   spawnEntity / spawnEntityAtPointer in Logic Boards tied to this scene.
   */
  scope?: 'scene-static' | 'scene+spawn-prototypes'
  /** Default true — hidden instances still need textures in editor preview. */
  includeHiddenInstances?: boolean
}

/** Resolved entities for one scene (v2 materialize + overlay, v1 entityIds). */
export function entitiesInScene(project: ProjectDoc, sceneId: string): EntityDef[] {
  const scene = project.scenes[sceneId]
  if (!scene) return []

  const hasObjectTypes =
    project.objectTypes != null && Object.keys(project.objectTypes).length > 0
  const types = project.objectTypes ?? {}

  if (hasObjectTypes && (scene.instances?.length ?? 0) > 0) {
    const out: EntityDef[] = []
    for (const inst of scene.instances ?? []) {
      const type = types[inst.objectTypeId]
      if (!type) continue
      let ent = materializeEntity(type, inst)
      const overlay = project.entities[inst.id]
      if (overlay) ent = overlay
      out.push(ent)
    }
    return out
  }

  const out: EntityDef[] = []
  for (const eid of scene.entityIds ?? []) {
    const ent = project.entities[eid]
    if (ent) out.push(ent)
  }
  return out
}

function addSpritePath(keys: Set<string>, path: string | undefined): void {
  const p = path?.trim()
  if (p) keys.add(p)
}

function addSpritePathFromPrototype(
  project: ProjectDoc,
  className: string,
  keys: Set<string>,
): void {
  const cn = className.trim()
  if (!cn) return
  const type = project.objectTypes?.[cn]
  if (type) {
    addSpritePath(keys, type.sprite.spriteAssetId)
    return
  }
  for (const ent of Object.values(project.entities)) {
    if (ent.className === cn) {
      addSpritePath(keys, ent.sprite.spriteAssetId)
      return
    }
  }
}

function instanceIdsInScene(project: ProjectDoc, sceneId: string): Set<number> {
  const scene = project.scenes[sceneId]
  const ids = new Set<number>()
  if (!scene) return ids
  for (const inst of scene.instances ?? []) ids.add(inst.id)
  for (const eid of scene.entityIds ?? []) ids.add(eid)
  return ids
}

function boardTargetsScene(
  board: LogicBoard,
  project: ProjectDoc,
  sceneId: string,
  sceneInstanceIds: Set<number>,
): boolean {
  const target = board.target
  if (target.type === 'entity_id' && target.entityId != null) {
    return sceneInstanceIds.has(target.entityId)
  }
  if (target.type === 'entity_class' && target.className) {
    const className = target.className
    for (const ent of entitiesInScene(project, sceneId)) {
      if (ent.className === className) return true
    }
    return false
  }
  if (target.type === 'object_type' && target.objectTypeId) {
    const scene = project.scenes[sceneId]
    for (const inst of scene?.instances ?? []) {
      if (inst.objectTypeId === target.objectTypeId) return true
    }
    for (const ent of entitiesInScene(project, sceneId)) {
      if (ent.className === target.objectTypeId) return true
    }
    return false
  }
  return false
}

function spawnClassNamesFromLogicBoards(
  project: ProjectDoc,
  sceneId: string,
): string[] {
  const boards = project.logicBoards ?? []
  if (boards.length === 0) return []
  const sceneInstanceIds = instanceIdsInScene(project, sceneId)
  const names = new Set<string>()
  for (const board of boards) {
    if (!boardTargetsScene(board, project, sceneId, sceneInstanceIds)) continue
    for (const event of board.events ?? []) {
      for (const action of event.actions ?? []) {
        collectSpawnClassName(action, names)
      }
    }
  }
  return [...names].sort()
}

function collectSpawnClassName(action: LogicAction, names: Set<string>): void {
  if (action.type === 'spawnEntity' && typeof action.className === 'string') {
    const cn = action.className.trim()
    if (cn) names.add(cn)
    return
  }
  if (action.type === 'spawnEntityAtPointer' && typeof action.className === 'string') {
    const cn = action.className.trim()
    if (cn) names.add(cn)
  }
}

function collectAudioPathFromAction(
  project: ProjectDoc,
  action: LogicAction,
  paths: Set<string>,
): void {
  if (action.type !== 'playSound' && action.type !== 'playMusic') return
  const id = action.audioAssetId?.trim()
  if (id) {
    const fromLib = project.audioAssets?.[id]?.path?.trim()
    if (fromLib) paths.add(fromLib)
    return
  }
  const raw = action.path?.trim()
  if (raw) paths.add(raw)
}

function collectAudioFromLogicBoards(
  project: ProjectDoc,
  sceneId: string,
): string[] {
  const boards = project.logicBoards ?? []
  if (boards.length === 0) return []
  const sceneInstanceIds = instanceIdsInScene(project, sceneId)
  const paths = new Set<string>()
  for (const board of boards) {
    if (!boardTargetsScene(board, project, sceneId, sceneInstanceIds)) continue
    for (const event of board.events ?? []) {
      for (const action of event.actions ?? []) {
        collectAudioPathFromAction(project, action, paths)
      }
    }
  }
  return [...paths].sort()
}

/** Audio paths referenced by Logic Boards tied to this scene (preview registration). */
export function collectSceneAudioRefs(project: ProjectDoc, sceneId: string): string[] {
  if (!project.scenes[sceneId]) return []
  return collectAudioFromLogicBoards(project, sceneId)
}

/**
 * Deterministic list of image paths required when `sceneId` is active in preview.
 */
export function collectSceneAssetRefs(
  project: ProjectDoc,
  sceneId: string,
  options?: CollectSceneAssetRefsOptions,
): SceneAssetLoadKey[] {
  const scene = project.scenes[sceneId]
  if (!scene) return []

  const scope = options?.scope ?? 'scene-static'
  const includeHidden = options?.includeHiddenInstances !== false
  const keys = new Set<string>()

  for (const ent of entitiesInScene(project, sceneId)) {
    if (!includeHidden && ent.visible === false) continue
    addSpritePath(keys, ent.sprite.spriteAssetId)
  }

  const tsId = scene.tilemap?.tilesetAssetId
  if (tsId) {
    const path = project.tilesets?.[tsId]?.spriteImagePath?.trim()
    if (path) keys.add(path)
  }

  if (scope === 'scene+spawn-prototypes') {
    for (const className of spawnClassNamesFromLogicBoards(project, sceneId)) {
      addSpritePathFromPrototype(project, className, keys)
    }
  }

  return [...keys].sort()
}
