// ---------------------------------------------------------------------------
// normalize-asset-refs — optional migration: paths → stable asset ids (Phase 1c)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'
import type { LogicAction, LogicBoard, LogicEvent } from '../types/logic-board'
import { imageAssetForRef } from './sprite-asset-ref'

export type NormalizeAssetRefsResult = Readonly<{
  changed: number
  project: ProjectDoc
}>

function audioLibraryIdForRef(project: ProjectDoc, raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const byId = project.audioAssets?.[trimmed]
  if (byId) return byId.id
  const byPath = Object.values(project.audioAssets ?? {}).find((a) => a.path === trimmed)
  return byPath?.id ?? null
}

function normalizeLogicActionAudio(project: ProjectDoc, action: LogicAction): LogicAction {
  if (action.type !== 'playSound' && action.type !== 'playMusic') return action
  const pathRaw = action.path?.trim()
  const idRaw = action.audioAssetId?.trim()
  const libId = audioLibraryIdForRef(project, pathRaw ?? idRaw ?? '')
  if (!libId || (libId === idRaw && !pathRaw)) return action
  const { path: _legacyPath, ...rest } = action
  return { ...rest, audioAssetId: libId }
}

function normalizeLogicActionList(
  project: ProjectDoc,
  actions: LogicAction[],
  onChanged: () => void,
): LogicAction[] {
  return actions.map((action) => {
    const normalized = normalizeLogicActionAudio(project, action)
    if (normalized !== action) onChanged()
    return normalized
  })
}

function normalizeLogicEvent(
  project: ProjectDoc,
  event: LogicEvent,
): { event: LogicEvent; changed: number } {
  let changed = 0
  const bump = () => { changed++ }
  const actions = normalizeLogicActionList(project, event.actions ?? [], bump)
  const elseActions = event.elseActions
    ? normalizeLogicActionList(project, event.elseActions, bump)
    : event.elseActions
  if (changed === 0) return { event, changed: 0 }
  return {
    event: {
      ...event,
      actions,
      ...(event.elseActions != null ? { elseActions } : {}),
    },
    changed,
  }
}

function normalizeLogicBoardsAudio(
  project: ProjectDoc,
  boards: LogicBoard[] | undefined,
): { boards: LogicBoard[] | undefined; changed: number } {
  if (!boards?.length) return { boards, changed: 0 }
  let changed = 0
  const nextBoards = boards.map((board) => {
    let boardChanged = false
    const events = (board.events ?? []).map((event) => {
      const { event: nextEvent, changed: eventChanged } = normalizeLogicEvent(project, event)
      if (eventChanged > 0) boardChanged = true
      changed += eventChanged
      return nextEvent
    })
    return boardChanged ? { ...board, events } : board
  })
  return {
    boards: changed > 0 ? nextBoards : boards,
    changed,
  }
}

/** Rewrite sprite/tileset/audio refs to stable library ids where a match exists. */
export function normalizeAssetRefs(project: ProjectDoc): NormalizeAssetRefsResult {
  let changed = 0
  const next: ProjectDoc = {
    ...project,
    entities: { ...project.entities },
    tilesets: project.tilesets ? { ...project.tilesets } : undefined,
  }

  for (const [eid, ent] of Object.entries(next.entities)) {
    const raw = ent.sprite?.spriteAssetId?.trim()
    if (!raw) continue
    const lib = imageAssetForRef(project, raw)
    if (!lib || lib.id === raw) continue
    next.entities[Number(eid)] = {
      ...ent,
      sprite: { ...ent.sprite, spriteAssetId: lib.id },
    }
    changed++
  }

  if (next.objectTypes) {
    const objectTypes = { ...next.objectTypes }
    for (const [typeId, type] of Object.entries(objectTypes)) {
      const raw = type.sprite?.spriteAssetId?.trim()
      if (!raw) continue
      const lib = imageAssetForRef(project, raw)
      if (!lib || lib.id === raw) continue
      objectTypes[typeId] = {
        ...type,
        sprite: { ...type.sprite, spriteAssetId: lib.id },
      }
      changed++
    }
    next.objectTypes = objectTypes
  }

  const { boards, changed: audioChanged } = normalizeLogicBoardsAudio(project, next.logicBoards)
  if (audioChanged > 0) {
    next.logicBoards = boards
    changed += audioChanged
  }

  return { changed, project: next }
}
