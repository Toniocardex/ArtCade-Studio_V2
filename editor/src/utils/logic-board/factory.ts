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
  LogicBoardLoadIssue,
  LogicEvent,
  LogicTrigger,
} from '../../types/logic-board'
import { validateLogicBoard, validateLogicEvent } from './schema-registry'
import { logicBoardGeneratedLabel } from './labels'
import { stripLegacyLogicActions } from './strip-legacy-actions'

let _seq = 0
/** Monotonic, collision-free id (good enough for editor undo/redo). */
export function logicId(prefix: string): string {
  _seq += 1
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`
}

/** A new empty event defaulting to an onSpawn trigger with no actions. */
export function createLogicEvent(
  trigger: LogicTrigger = { type: 'onSpawn' },
  actions: LogicAction[] = [],
): LogicEvent {
  return {
    id: logicId('evt'),
    enabled: true,
    trigger,
    actions: stripLegacyLogicActions(actions),
  }
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

/** A new board targeting an object type (primary shared behavior). */
export function createLogicBoardForObjectType(
  objectTypeId: string,
  boardId = logicId('board'),
  name?: string,
): LogicBoard {
  return {
    boardId,
    name: name?.trim() || logicBoardGeneratedLabel(boardId),
    target: { type: 'object_type', objectTypeId },
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

  const event: LogicEvent = {
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
    ...(r.conditionsOperator === 'OR' ||
    r.conditionsOperator === 'AND' ||
    r.conditionsOperator === 'NOT'
      ? { conditionsOperator: r.conditionsOperator }
      : {}),
    ...(r.conditionRoot && typeof r.conditionRoot === 'object'
      ? { conditionRoot: r.conditionRoot as LogicEvent['conditionRoot'] }
      : {}),
    actions: stripLegacyLogicActions(asArray(r.actions) as LogicAction[]),
    ...(typeof r.elseEnabled === 'boolean' ? { elseEnabled: r.elseEnabled } : {}),
    ...(Array.isArray(r.elseActions)
      ? { elseActions: stripLegacyLogicActions(r.elseActions as LogicAction[]) }
      : {}),
  }
  return event
}

function parseBoard(
  raw: unknown,
  issues: LogicBoardLoadIssue[],
): LogicBoard | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.boardId !== 'string' || !r.boardId) return null

  const targetRaw =
    r.target && typeof r.target === 'object'
      ? (r.target as Record<string, unknown>)
      : {}
  let type: LogicBoard['target']['type'] =
    targetRaw.type === 'entity_id' ||
    targetRaw.type === 'object_type' ||
    targetRaw.type === 'scene' ||
    targetRaw.type === 'global'
      ? targetRaw.type
      : 'entity_class'

  if (type === 'entity_class' && targetRaw.className) {
    type = 'object_type'
  }

  const boardId = r.boardId
  const events = asArray(r.events)
    .map(parseEvent)
    .filter((e): e is LogicEvent => e !== null)
    .map((e, i) => {
      const vr = validateLogicEvent(e, `/events[${i}]`)
      if (!vr.valid) {
        const messages = vr.errors.map((x) => `${x.path} ${x.message}`)
        console.warn(
          `[LogicBoard] Invalid event on board "${boardId}" (kept for repair):`,
          messages.join('; '),
        )
        issues.push({ boardId, eventIndex: i, errors: messages })
      }
      return e
    })

  const board: LogicBoard = {
    boardId: r.boardId,
    ...(typeof r.name === 'string' && r.name.trim()
      ? { name: r.name.trim() }
      : {}),
    target: {
      type,
      ...(type === 'object_type'
        ? {
            objectTypeId: String(
              targetRaw.objectTypeId ?? targetRaw.object_type_id ?? targetRaw.className ?? '',
            ),
          }
        : {}),
      ...(type === 'entity_class' && targetRaw.className != null
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

export interface ParseLogicBoardsResult {
  doc?: LogicBoardDoc
  issues: LogicBoardLoadIssue[]
}

/**
 * Parse the `logicBoards` field of a project.json. Invalid events are kept so
 * the user can repair them; issues are returned for console warnings on load.
 */
export function parseLogicBoardsWithIssues(raw: unknown): ParseLogicBoardsResult {
  const issues: LogicBoardLoadIssue[] = []
  if (!Array.isArray(raw)) return { doc: undefined, issues }
  const boards = raw
    .map((item) => parseBoard(item, issues))
    .filter((b): b is LogicBoard => b !== null)
  return {
    doc: boards.length > 0 ? boards : undefined,
    issues,
  }
}

/**
 * Parse the `logicBoards` field of a project.json. Returns undefined when the
 * field is absent or not an array, so the project simply has no boards.
 */
export function parseLogicBoards(raw: unknown): LogicBoardDoc | undefined {
  return parseLogicBoardsWithIssues(raw).doc
}

/** English summary for console when boards have load-time validation issues. */
export function formatLogicBoardLoadIssuesMessage(issues: LogicBoardLoadIssue[]): string {
  const n = issues.length
  if (n === 0) return ''
  const boards = new Set(issues.map((i) => i.boardId)).size
  return `${n} Logic Board event(s) on ${boards} board(s) need repair before save — see warnings above.`
}
