import type { AnimationClipDef, EntityDef, ProjectDoc, SpriteComponent } from '../types'
import type { LogicBoard } from '../types/logic-board'
import {
  clipExistsOnSpritePath,
  clipsForSpritePath,
} from './animation-clips-catalog'
import { entitiesForRuntimeSync } from './project-object-types'
import { logicBoardTargetEntityIds } from './project-queries'

export type EntityClipResolution = Readonly<{
  entityId: number
  spritePath: string
  defaultClip?: string
  playClipOnSpawn: boolean
  clips: AnimationClipDef[]
}>

export type LogicBoardClipContext = Readonly<{
  spritePath?: string
  /** Target instances use different sprite sheets — do not filter the clip picker. */
  ambiguousSpritePath?: boolean
}>

/** Normalize defaultClip / playClipOnSpawn against the assigned sheet. */
export function normalizeSpriteClipFields(
  sprite: SpriteComponent,
  project: ProjectDoc | null | undefined,
): Pick<SpriteComponent, 'defaultClip' | 'playClipOnSpawn'> {
  const spritePath = sprite.spriteAssetId?.trim() ?? ''
  const defaultClip =
    sprite.defaultClip?.trim() &&
    clipExistsOnSpritePath(project, spritePath, sprite.defaultClip.trim())
      ? sprite.defaultClip.trim()
      : undefined
  return {
    defaultClip,
    playClipOnSpawn: defaultClip ? sprite.playClipOnSpawn === true : false,
  }
}

/**
 * Resolved clip context for one entity (materialized type + Inspector overrides).
 * Use for Inspector UI, runtime fingerprint, and per-instance validation.
 */
export function resolveClipForEntity(
  project: ProjectDoc | null | undefined,
  entityId: number | null | undefined,
  entityOverride?: EntityDef | null,
): EntityClipResolution | undefined {
  if (!project || entityId == null) return undefined

  const entity =
    entityOverride ??
    entitiesForRuntimeSync(project)[entityId] ??
    project.entities?.[entityId]
  if (!entity) return undefined

  const spritePath = entity.sprite.spriteAssetId?.trim() ?? ''
  const { defaultClip, playClipOnSpawn } = normalizeSpriteClipFields(entity.sprite, project)

  return {
    entityId,
    spritePath,
    defaultClip,
    playClipOnSpawn: playClipOnSpawn === true,
    clips: clipsForSpritePath(project, spritePath),
  }
}

/**
 * Sprite sheet path for Logic Board clip pickers when all targeted instances agree.
 */
export function resolveClipContextForLogicBoard(
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
): LogicBoardClipContext {
  if (!project || !board) return {}

  const ids = logicBoardTargetEntityIds(project, board)
  if (ids.length === 0) return {}

  const paths = new Set<string>()
  for (const id of ids) {
    const resolved = resolveClipForEntity(project, id)
    if (resolved?.spritePath) paths.add(resolved.spritePath)
  }

  if (paths.size === 0) return {}
  if (paths.size === 1) return { spritePath: [...paths][0] }
  return { ambiguousSpritePath: true }
}

/** @deprecated Prefer {@link resolveClipContextForLogicBoard}. */
export function spritePathForLogicBoardTarget(
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
): string | undefined {
  return resolveClipContextForLogicBoard(project, board).spritePath
}
