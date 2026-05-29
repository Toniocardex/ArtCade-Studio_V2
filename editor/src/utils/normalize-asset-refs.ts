// ---------------------------------------------------------------------------
// normalize-asset-refs — optional migration: paths → stable asset ids (Phase 1c)
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'
import type { LogicAction, LogicBoard } from '../types/logic-board'
import { resolveImageLoadKey } from './resolve-image-load-key'

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

function normalizeLogicBoardsAudio(
  project: ProjectDoc,
  boards: LogicBoard[] | undefined,
): { boards: LogicBoard[] | undefined; changed: number } {
  if (!boards?.length) return { boards, changed: 0 }
  let changed = 0
  const nextBoards = boards.map((board) => {
    let boardChanged = false
    const events = (board.events ?? []).map((event) => {
      let eventChanged = false
      const actions = (event.actions ?? []).map((action) => {
        const normalized = normalizeLogicActionAudio(project, action)
        if (normalized !== action) {
          eventChanged = true
          changed++
        }
        return normalized
      })
      if (eventChanged) boardChanged = true
      return eventChanged ? { ...event, actions } : event
    })
    return boardChanged ? { ...board, events } : board
  })
  return {
    boards: changed > 0 ? nextBoards : boards,
    changed,
  }
}

function normalizeLogicActionAudio(project: ProjectDoc, action: LogicAction): LogicAction {
  if (action.type !== 'playSound' && action.type !== 'playMusic') return action
  const pathRaw = action.path?.trim()
  const idRaw = action.audioAssetId?.trim()
  const libId = audioLibraryIdForRef(project, pathRaw ?? idRaw ?? '')
  if (!libId || (libId === idRaw && !pathRaw)) return action
  const { path: _path, ...rest } = action
  return { ...rest, audioAssetId: libId }
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
    const path = resolveImageLoadKey(project, raw)
    const lib = path
      ? Object.values(project.assets ?? {}).find((a) => a.path === path)
      : undefined
    if (!lib || lib.id === raw) continue
    next.entities[Number(eid)] = {
      ...ent,
      sprite: { ...ent.sprite, spriteAssetId: lib.id },
    }
    changed++
  }

  if (next.tilesets) {
    for (const [tid, ts] of Object.entries(next.tilesets)) {
      const raw = ts.spriteImagePath?.trim()
      if (!raw) continue
      const path = resolveImageLoadKey(project, raw)
      const lib = path
        ? Object.values(project.assets ?? {}).find((a) => a.path === path)
        : undefined
      if (!lib || lib.id === raw) continue
      next.tilesets![tid] = { ...ts, spriteImagePath: lib.id }
      changed++
    }
  }

  const { boards, changed: audioChanged } = normalizeLogicBoardsAudio(project, next.logicBoards)
  if (audioChanged > 0) {
    next.logicBoards = boards
    changed += audioChanged
  }

  return { changed, project: next }
}
