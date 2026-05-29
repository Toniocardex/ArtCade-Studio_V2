// ---------------------------------------------------------------------------
// strip-project-asset-refs — detach project references when an asset is removed
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'
import type { LogicAction, LogicBoard } from '../types/logic-board'

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
    events: (board.events ?? []).map((event) => ({
      ...event,
      actions: (event.actions ?? []).map((a) => scrubAudioAction(a, audioId, audioPath)),
    })),
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
  return { ...project, assets, entities }
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
  return { ...project, fontAssets }
}

function removeTilesetRefs(
  project: ProjectDoc,
  removed: Extract<RemovedAssetRef, { kind: 'tileset' }>,
): ProjectDoc {
  const tilesets = Object.fromEntries(
    Object.entries(project.tilesets ?? {}).filter(([k]) => k !== removed.id),
  )
  const scenes = Object.fromEntries(
    Object.entries(project.scenes).map(([sid, sc]) => {
      if (sc.tilemap?.tilesetAssetId !== removed.id) return [sid, sc]
      const { tilesetAssetId: _drop, ...rest } = sc.tilemap
      return [sid, { ...sc, tilemap: rest }]
    }),
  )
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
