import type { EntityDef, ProjectDoc } from '../types'
import type { LogicAction } from '../types/logic-board'
import type { TilemapLayer } from '../types/tilemap'
import { tilesetIdsOnLayer } from './tilemap-layer-sources'
import { imageAssetForRef } from './sprite-asset-ref'

export type AssetRefKind = 'image' | 'audio' | 'font' | 'tileset'

export type AssetRefTarget =
  | { kind: 'image'; id: string; path: string }
  | { kind: 'audio'; id: string; path: string }
  | { kind: 'font'; id: string; path: string }
  | { kind: 'tileset'; id: string }

export type ProjectAssetReference = Readonly<{
  kind: AssetRefKind
  label: string
  location: string
}>

function pushRef(
  refs: ProjectAssetReference[],
  seen: Set<string>,
  kind: AssetRefKind,
  label: string,
  location: string,
): void {
  const key = `${kind}\0${label}\0${location}`
  if (seen.has(key)) return
  seen.add(key)
  refs.push({ kind, label, location })
}

function entityLabel(entity: EntityDef, fallback: string): string {
  return entity.name?.trim() || entity.className?.trim() || fallback
}

function entityUsesImageAsset(
  project: ProjectDoc,
  entity: EntityDef,
  target: Extract<AssetRefTarget, { kind: 'image' }>,
): boolean {
  const ref = entity.sprite?.spriteAssetId?.trim()
  if (!ref) return false
  if (ref === target.id || ref === target.path) return true
  const asset = imageAssetForRef(project, ref)
  return asset?.id === target.id || asset?.path === target.path
}

function collectEntityRefs(
  project: ProjectDoc,
  entity: EntityDef,
  target: AssetRefTarget,
  refs: ProjectAssetReference[],
  seen: Set<string>,
  location: string,
): void {
  if (target.kind === 'image' && entityUsesImageAsset(project, entity, target)) {
    pushRef(refs, seen, 'image', 'sprite texture', location)
  }
  if (target.kind === 'font' && entity.text?.fontPath?.trim() === target.path) {
    pushRef(refs, seen, 'font', 'text font', location)
  }
}

function collectActionRefs(
  project: ProjectDoc,
  action: LogicAction,
  target: AssetRefTarget,
  refs: ProjectAssetReference[],
  seen: Set<string>,
  location: string,
): void {
  if (target.kind === 'audio' && (action.type === 'playSound' || action.type === 'playMusic')) {
    if (action.audioAssetId?.trim() === target.id || action.path?.trim() === target.path) {
      pushRef(refs, seen, 'audio', `${action.type} action`, location)
    }
    return
  }

  if (target.kind === 'image' && action.type === 'playAnimation') {
    const clipName = action.clipName?.trim()
    if (!clipName) return
    const asset = project.assets?.[target.id]
    if (asset?.clips?.some((clip) => clip.name.trim() === clipName)) {
      pushRef(refs, seen, 'image', `animation clip "${clipName}"`, location)
    }
  }
}

function collectTilemapLayerRefs(
  layer: TilemapLayer | undefined,
  target: AssetRefTarget,
  refs: ProjectAssetReference[],
  seen: Set<string>,
  location: string,
): void {
  if (target.kind !== 'tileset' || !layer) return
  if (tilesetIdsOnLayer(layer).includes(target.id)) {
    pushRef(refs, seen, 'tileset', 'tilemap layer', location)
  }
}

/** Collect all project dependencies that should block direct asset deletion. */
export function collectProjectAssetRefs(
  project: ProjectDoc,
  target: AssetRefTarget,
): ProjectAssetReference[] {
  const refs: ProjectAssetReference[] = []
  const seen = new Set<string>()

  for (const [typeId, type] of Object.entries(project.objectTypes ?? {})) {
    collectEntityRefs(
      project,
      { ...type, id: -1, name: type.displayName, className: type.id, transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      } },
      target,
      refs,
      seen,
      `Object type "${type.displayName || typeId}"`,
    )
  }

  for (const [id, entity] of Object.entries(project.entities ?? {})) {
    collectEntityRefs(
      project,
      entity,
      target,
      refs,
      seen,
      `Object "${entityLabel(entity, `#${id}`)}"`,
    )
  }

  for (const scene of Object.values(project.scenes ?? {})) {
    collectTilemapLayerRefs(scene.tilemap, target, refs, seen, `Scene "${scene.name}" tilemap`)
    for (const [layerName, layer] of Object.entries(scene.tilemapLayers ?? {})) {
      collectTilemapLayerRefs(
        layer,
        target,
        refs,
        seen,
        `Scene "${scene.name}" layer "${layerName}"`,
      )
    }
  }

  for (const board of project.logicBoards ?? []) {
    const boardName = board.name?.trim() || board.boardId
    for (const event of board.events ?? []) {
      const eventId = event.id?.trim() || 'event'
      const base = `Logic Board "${boardName}" event "${eventId}"`
      for (const action of event.actions ?? []) {
        collectActionRefs(project, action, target, refs, seen, base)
      }
      for (const action of event.elseActions ?? []) {
        collectActionRefs(project, action, target, refs, seen, `${base} else`)
      }
    }
  }

  return refs.sort((a, b) => a.location.localeCompare(b.location) || a.label.localeCompare(b.label))
}

export function formatAssetDeleteBlockMessage(
  assetName: string,
  refs: readonly ProjectAssetReference[],
): string {
  const preview = refs.slice(0, 6).map((ref) => `- ${ref.location}: ${ref.label}`)
  const remaining = refs.length - preview.length
  const suffix = remaining > 0 ? `\n- ...and ${remaining} more reference${remaining === 1 ? '' : 's'}` : ''
  return [
    `Cannot remove "${assetName}".`,
    '',
    'It is still used by:',
    ...preview,
    suffix,
    '',
    'Remove or reassign these references first.',
  ].filter(Boolean).join('\n')
}
