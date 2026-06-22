// ---------------------------------------------------------------------------
// collect-scene-asset-refs — static closure over ProjectDoc for scene textures
// See docs/ASSET_PIPELINE_ARCHITECTURE.md §5.1
// ---------------------------------------------------------------------------

import type { EntityDef, ProjectDoc, SceneDef } from '../types'
import type { TilesetAsset } from '../types/tilemap'
import type { LogicAction, LogicBoard } from '../types/logic-board'
import { materializeEntity } from './project-object-types'
import { tilesetIdsOnLayer } from './tilemap-layer-sources'

/** v1: project-relative path used as TextureCache key (same as spriteAssetId today). */
export type SceneAssetLoadKey = string

export interface CollectSceneAssetRefsOptions {
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

/** Collect tileset image paths referenced by a scene (per-layer + legacy merged tilemap). */
export function tilesetPathsForScene(
  scene: SceneDef,
  tilesets: Record<string, TilesetAsset> | undefined,
): string[] {
  const paths = new Set<string>()
  if (scene.tilemapLayers) {
    for (const layer of Object.values(scene.tilemapLayers)) {
      for (const tsId of tilesetIdsOnLayer(layer)) {
        const path = tilesets?.[tsId]?.spriteImagePath?.trim()
        if (path) paths.add(path)
      }
    }
  }
  const legacyId = scene.tilemap?.tilesetAssetId?.trim()
  if (legacyId) {
    const path = tilesets?.[legacyId]?.spriteImagePath?.trim()
    if (path) paths.add(path)
  }
  return [...paths]
}

function boardTargetsScene(
  board: LogicBoard,
  project: ProjectDoc,
  sceneId: string,
): boolean {
  const target = board.target
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
  const paths = new Set<string>()
  for (const board of boards) {
    if (!boardTargetsScene(board, project, sceneId)) continue
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

/** Sheet path(s) holding a clip a `playAnimation` action targets. A clip may
 *  live on a sheet different from the object's static sprite (cross-sheet
 *  animation), so that sheet's texture must also be uploaded for preview. */
function collectClipSheetFromAction(
  project: ProjectDoc,
  action: LogicAction,
  paths: Set<string>,
): void {
  if (action.type !== 'playAnimation') return
  const clipName = action.clipName?.trim()
  if (!clipName) return
  for (const asset of Object.values(project.assets ?? {})) {
    if (asset.clips?.some((c) => c.name.trim() === clipName)) {
      addSpritePath(paths, asset.path)
    }
  }
}

function collectClipSheetsFromLogicBoards(
  project: ProjectDoc,
  sceneId: string,
): string[] {
  const boards = project.logicBoards ?? []
  if (boards.length === 0) return []
  const paths = new Set<string>()
  for (const board of boards) {
    if (!boardTargetsScene(board, project, sceneId)) continue
    for (const event of board.events ?? []) {
      for (const action of event.actions ?? []) {
        collectClipSheetFromAction(project, action, paths)
      }
      for (const action of event.elseActions ?? []) {
        collectClipSheetFromAction(project, action, paths)
      }
    }
  }
  return [...paths]
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

  const includeHidden = options?.includeHiddenInstances !== false
  const keys = new Set<string>()

  for (const ent of entitiesInScene(project, sceneId)) {
    if (!includeHidden && ent.visible === false) continue
    addSpritePath(keys, ent.sprite.spriteAssetId)
  }

  for (const path of tilesetPathsForScene(scene, project.tilesets)) {
    keys.add(path)
  }

  // Cross-sheet animation: clips a scene object can play may live on a sheet
  // other than its static sprite — upload those sheets too.
  for (const path of collectClipSheetsFromLogicBoards(project, sceneId)) {
    keys.add(path)
  }

  return [...keys].sort()
}
