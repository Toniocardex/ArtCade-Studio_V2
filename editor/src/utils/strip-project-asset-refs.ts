// ---------------------------------------------------------------------------
// strip-project-asset-refs — detach project references when an asset is removed
// ---------------------------------------------------------------------------

import type { ProjectDoc, TilemapLayer } from '../types'
import type { LogicAction, LogicBoard } from '../types/logic-board'
import { scrubTilesetFromLayer } from './tilemap-layer-sources'

export type RemovedAssetRef =
  | { kind: 'image'; id: string; path: string }
  | { kind: 'audio'; id: string; path: string }
  | { kind: 'font'; id: string; path: string }
  | { kind: 'tileset'; id: string }

function scrubAudioAction(
  action: LogicAction,
  audioId: string,
  audioPath: string,
): LogicAction {
  if (action.type !== 'playSound' && action.type !== 'playMusic') return action
  const next = { ...action }
  if (next.audioAssetId?.trim() === audioId) {
    delete next.audioAssetId
  }
  const path = next.path?.trim()
  if (audioPath && path === audioPath) {
    delete next.path
  }
  return next
}

function scrubLogicBoardsForAudio(
  boards: LogicBoard[] | undefined,
  audioId: string,
  audioPath: string,
): LogicBoard[] | undefined {
  if (!boards || boards.length === 0) return boards
  return boards.map((board) => ({
    ...board,
    events: (board.events ?? []).map((event) => {
      const next = {
        ...event,
        actions: (event.actions ?? []).map((a) => scrubAudioAction(a, audioId, audioPath)),
      }
      return event.elseActions
        ? { ...next, elseActions: event.elseActions.map((a) => scrubAudioAction(a, audioId, audioPath)) }
        : next
    }),
  }))
}

function removeImageRefs(project: ProjectDoc, removed: Extract<RemovedAssetRef, { kind: 'image' }>): ProjectDoc {
  const assets = Object.fromEntries(
    Object.entries(project.assets ?? {}).filter(([k]) => k !== removed.id),
  )
  const entities = Object.fromEntries(
    Object.entries(project.entities).map(([eid, e]) =>
      e.sprite?.spriteAssetId === removed.path
        ? [eid, { ...e, sprite: { ...e.sprite, spriteAssetId: '' } }]
        : [eid, e],
    ),
  )
  if (!project.objectTypes) return { ...project, assets, entities }
  const objectTypes = Object.fromEntries(
    Object.entries(project.objectTypes).map(([id, type]) =>
      type.sprite?.spriteAssetId === removed.path
        ? [id, { ...type, sprite: { ...type.sprite, spriteAssetId: '' } }]
        : [id, type],
    ),
  )
  return { ...project, assets, entities, objectTypes }
}

function removeAudioRefs(project: ProjectDoc, removed: Extract<RemovedAssetRef, { kind: 'audio' }>): ProjectDoc {
  const audioAssets = Object.fromEntries(
    Object.entries(project.audioAssets ?? {}).filter(([k]) => k !== removed.id),
  )
  const logicBoards = scrubLogicBoardsForAudio(
    project.logicBoards,
    removed.id,
    removed.path,
  )
  return { ...project, audioAssets, logicBoards }
}

function removeFontRefs(project: ProjectDoc, removed: Extract<RemovedAssetRef, { kind: 'font' }>): ProjectDoc {
  const fontAssets = Object.fromEntries(
    Object.entries(project.fontAssets ?? {}).filter(([k]) => k !== removed.id),
  )
  const clearFont = <T extends { text?: { fontPath: string } }>(entry: T): T =>
    entry.text?.fontPath === removed.path
      ? { ...entry, text: { ...entry.text, fontPath: '' } }
      : entry
  const entities = Object.fromEntries(
    Object.entries(project.entities).map(([id, entity]) => [id, clearFont(entity)]),
  )
  if (!project.objectTypes) return { ...project, fontAssets, entities }
  const objectTypes = Object.fromEntries(
    Object.entries(project.objectTypes).map(([id, type]) => [id, clearFont(type)]),
  )
  return { ...project, fontAssets, entities, objectTypes }
}

function scrubSceneTilemaps(
  scenes: ProjectDoc['scenes'],
  removedId: string,
): ProjectDoc['scenes'] {
  return Object.fromEntries(
    Object.entries(scenes).map(([sid, sc]) => {
      let next = sc
      if (sc.tilemap) {
        const tm = scrubTilesetFromLayer(sc.tilemap, removedId)
        if (tm !== sc.tilemap) next = { ...next, tilemap: tm }
      }
      if (sc.tilemapLayers) {
        const tilemapLayers = Object.fromEntries(
          Object.entries(sc.tilemapLayers).map(([name, layer]) => [
            name,
            scrubTilesetFromLayer(layer, removedId),
          ]),
        ) as Record<string, TilemapLayer>
        next = { ...next, tilemapLayers }
      }
      return [sid, next]
    }),
  )
}

function removeTilesetRefs(
  project: ProjectDoc,
  removed: Extract<RemovedAssetRef, { kind: 'tileset' }>,
): ProjectDoc {
  const tilesets = Object.fromEntries(
    Object.entries(project.tilesets ?? {}).filter(([k]) => k !== removed.id),
  )
  const scenes = scrubSceneTilemaps(project.scenes, removed.id)
  return { ...project, tilesets, scenes }
}

/** Returns a new ProjectDoc with library entry removed and dependent refs detached. */
export function projectAfterRemovingAsset(
  project: ProjectDoc,
  removed: RemovedAssetRef,
): ProjectDoc {
  switch (removed.kind) {
    case 'image':
      return removeImageRefs(project, removed)
    case 'audio':
      return removeAudioRefs(project, removed)
    case 'font':
      return removeFontRefs(project, removed)
    case 'tileset':
      return removeTilesetRefs(project, removed)
  }
}
