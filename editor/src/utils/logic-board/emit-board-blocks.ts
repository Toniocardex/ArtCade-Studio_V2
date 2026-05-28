// ---------------------------------------------------------------------------
// Shared Lua block scaffolding for compiler.ts (entity scope / global scope).
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import { INDENT, luaString } from './lua-helpers'
import { emitEventBody } from './emit-event-body'

/** Push a global `do` block or a `for _, self in ipairs(pool)` loop with body lines. */
export function pushEntityScopedBlock(
  out: string[],
  baseIndent: string,
  pool: string,
  isGlobal: boolean,
  withOtherLocal: boolean,
  bodyLines: string[],
): void {
  if (isGlobal) {
    const lines = [
      `${baseIndent}do`,
      `${baseIndent}${INDENT}local self = nil`,
      `${baseIndent}${INDENT}local other = nil`,
      ...bodyLines,
      `${baseIndent}end`,
    ]
    out.push(...lines)
    return
  }

  const loopHead = [`${baseIndent}for _, self in ipairs(${pool}) do`]
  if (withOtherLocal) {
    loopHead.push(`${baseIndent}${INDENT}local other = nil`)
  }
  out.push(...loopHead, ...bodyLines, `${baseIndent}end`)
}

export function pushEventBodies(
  out: string[],
  events: LogicEvent[],
  board: LogicBoard,
  bodyIndent: string,
  slugs: Map<string, string>,
): void {
  for (const ev of events) {
    out.push(...emitEventBody(ev, board, bodyIndent, slugs))
  }
}

export function pushStartEventsInit(
  init: string[],
  startEvents: LogicEvent[],
  board: LogicBoard,
  pool: string,
  isGlobal: boolean,
  slugs: Map<string, string>,
): void {
  if (startEvents.length === 0) return
  const body: string[] = []
  pushEventBodies(body, startEvents, board, INDENT + INDENT, slugs)
  pushEntityScopedBlock(init, INDENT, pool, isGlobal, false, body)
}

export function pushTickEventsBlock(
  tick: string[],
  tickEvents: LogicEvent[],
  board: LogicBoard,
  pool: string,
  isGlobal: boolean,
  slugs: Map<string, string>,
): void {
  if (tickEvents.length === 0) return
  const body: string[] = []
  pushEventBodies(body, tickEvents, board, INDENT + INDENT, slugs)
  pushEntityScopedBlock(tick, INDENT, pool, isGlobal, !isGlobal, body)
}

function messageHandlerBody(
  ev: LogicEvent,
  board: LogicBoard,
  pool: string,
  isGlobal: boolean,
  slugs: Map<string, string>,
): string[] {
  const I = INDENT
  if (isGlobal) {
    const body: string[] = [
      `${I}${I}local self = nil`,
      `${I}${I}local other = nil`,
    ]
    pushEventBodies(body, [ev], board, I + I, slugs)
    return body
  }
  const body: string[] = [
    `${I}${I}for _, self in ipairs(${pool}) do`,
    `${I}${I}${I}local other = nil`,
  ]
  pushEventBodies(body, [ev], board, I + I + I, slugs)
  body.push(`${I}${I}end`)
  return body
}

export function pushMessageEventsInit(
  init: string[],
  messageEvents: LogicEvent[],
  board: LogicBoard,
  pool: string,
  isGlobal: boolean,
  slugs: Map<string, string>,
): void {
  for (const ev of messageEvents) {
    if (ev.trigger.type !== 'onMessage') continue
    const I = INDENT
    init.push(
      `${I}_logic_reg_message(${luaString(ev.trigger.messageName)}, function()`,
      ...messageHandlerBody(ev, board, pool, isGlobal, slugs),
      `${I}end)`,
    )
  }
}

export function pushDestroyTickBlock(
  tick: string[],
  destroyTickEvents: LogicEvent[],
  board: LogicBoard,
  slugs: Map<string, string>,
): void {
  if (destroyTickEvents.length === 0) return
  const body: string[] = []
  pushEventBodies(body, destroyTickEvents, board, INDENT + INDENT, slugs)
  tick.push(
    `${INDENT}for _, de in ipairs(_destroy_events) do`,
    `${INDENT}${INDENT}local self = de.entityId`,
    `${INDENT}${INDENT}local other = nil`,
    ...body,
    `${INDENT}end`,
  )
}
