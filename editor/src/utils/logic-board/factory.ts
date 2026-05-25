// ---------------------------------------------------------------------------
// Logic Board factory + defensive parsing helpers.
//
// Shared by the editor store (creating boards/events with sane defaults) and
// by project.ts (parsing untrusted JSON from disk). Keeping construction in
// one place keeps ids unique and shapes consistent.
// ---------------------------------------------------------------------------

import type {
  LogicAction,
  LogicBoard,
  LogicBoardDoc,
  LogicEvent,
  LogicTrigger,
} from '../../types/logic-board'
import { validateLogicBoard, validateLogicEvent } from './schema-registry'
import { logicBoardGeneratedLabel } from './labels'

let _seq = 0
/** Monotonic, collision-free id (good enough for editor undo/redo). */
export function logicId(prefix: string): string {
  _seq += 1
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`
}

/** A new empty event defaulting to an onSpawn trigger with no actions. */
export function createLogicEvent(
  trigger: LogicTrigger = { type: 'onSpawn', className: '' },
  actions: LogicAction[] = [],
): LogicEvent {
  return { id: logicId('evt'), enabled: true, trigger, actions }
}

/** A new board targeting a single scene entity (primary editor workflow). */
export function createLogicBoardForEntity(
  entityId: number,
  boardId = logicId('board'),
  name?: string,
): LogicBoard {
  return {
    boardId,
    name: name?.trim() || logicBoardGeneratedLabel(boardId),
    target: { type: 'entity_id', entityId },
    events: [],
  }
}

/** A new board targeting an entity class (advanced / shared behavior). */
export function createLogicBoard(
  className: string,
  boardId = logicId('board'),
  name?: string,
): LogicBoard {
  return {
    boardId,
    name: name?.trim() || logicBoardGeneratedLabel(boardId),
    target: { type: 'entity_class', className },
    events: [],
  }
}

// ---- defensive parsing ----------------------------------------------------

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function parseEvent(raw: unknown): LogicEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const trigger = r.trigger
  if (!trigger || typeof trigger !== 'object') return null
  if (typeof (trigger as Record<string, unknown>).type !== 'string') return null

  return {
    id: typeof r.id === 'string' && r.id ? r.id : logicId('evt'),
    enabled: r.enabled !== false, // default true
    trigger: trigger as LogicTrigger,
    ...(typeof r.onlyIfEnabled === 'boolean'
      ? { onlyIfEnabled: r.onlyIfEnabled }
      : {}),
    // conditions / conditionRoot are passed through as-is; the compiler has
    // safe fallbacks for missing/empty shapes.
    ...(Array.isArray(r.conditions)
      ? { conditions: r.conditions as LogicEvent['conditions'] }
      : {}),
    ...(r.conditionRoot && typeof r.conditionRoot === 'object'
      ? { conditionRoot: r.conditionRoot as LogicEvent['conditionRoot'] }
      : {}),
    actions: asArray(r.actions) as LogicAction[],
  }
}

function parseBoard(raw: unknown): LogicBoard | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.boardId !== 'string' || !r.boardId) return null

  const targetRaw =
    r.target && typeof r.target === 'object'
      ? (r.target as Record<string, unknown>)
      : {}
  const type =
    targetRaw.type === 'entity_id' || targetRaw.type === 'scene'
      ? targetRaw.type
      : 'entity_class'

  const events = asArray(r.events)
    .map(parseEvent)
    .filter((e): e is LogicEvent => e !== null)
    .filter((e, i) => {
      const vr = validateLogicEvent(e, `/events[${i}]`)
      if (vr.valid) return true
      console.warn(
        `[LogicBoard] Dropped invalid event on board "${r.boardId}":`,
        vr.errors.map((x) => `${x.path} ${x.message}`).join('; '),
      )
      return false
    })

  const board: LogicBoard = {
    boardId: r.boardId,
    ...(typeof r.name === 'string' && r.name.trim()
      ? { name: r.name.trim() }
      : {}),
    target: {
      type,
      ...(targetRaw.className != null
        ? { className: String(targetRaw.className) }
        : {}),
      ...(targetRaw.entityId != null
        ? { entityId: Number(targetRaw.entityId) }
        : {}),
    },
    events,
  }

  const br = validateLogicBoard(board)
  if (!br.valid) {
    console.warn(
      `[LogicBoard] Board "${r.boardId}" has structural issues:`,
      br.errors.map((x) => x.message).join('; '),
    )
  }

  return board
}

/**
 * Parse the `logicBoards` field of a project.json. Returns undefined when the
 * field is absent or not an array, so the project simply has no boards.
 */
export function parseLogicBoards(raw: unknown): LogicBoardDoc | undefined {
  if (!Array.isArray(raw)) return undefined
  const boards = raw
    .map(parseBoard)
    .filter((b): b is LogicBoard => b !== null)
  return boards.length > 0 ? boards : undefined
}
