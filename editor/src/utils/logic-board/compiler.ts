// ---------------------------------------------------------------------------
// Logic Board compiler — turns a LogicBoardDoc into a single Lua source string.
//
// This file is the orchestrator only. Heavy lifting lives in sibling modules
// you can jump to directly:
//
//   • condition-expr.ts          — conditionExpr(ev) → Lua boolean
//   • emit-actions.ts            — emitActionSequence / emitGuardedActions
//   • emit-event-body.ts         — emitEventBody (per-tick scaffolding)
//   • emit-event-registration.ts — emitEventRegistration (init callbacks)
//   • compiler-prelude.ts        — buildHeader, buildTickWrapper, poll preambles
//   • event-slugs.ts             — buildEventSlugs, ruleKeyExpr (RULE.<slug>)
//   • action-emitter.ts          — actionLua (one statement per action)
//   • lua-helpers.ts             — luaPointerNearSelfExpr, luaPointerWorldPairStmt
//
// Pointer / hit-test policy (do not regress):
//   • Object click, hover, isMouseOver, spawn-at-pointer → input.mouseWorld()
//     via luaPointerNearSelfExpr / luaPointerWorldPairStmt only.
//   • Never mix input.mousePosition() with entity.position(self) for distance.
//   • Guard: pointer-hit-policy.test.ts
//
// Design constraints (verified against the real runtime):
//   • The C++ runtime calls `tick(dt)` for polling triggers; event-first
//     triggers register handlers during `_logic_init()`.
//   • The generated Lua uses the dot-notation API prelude exposed by
//     runtime-cpp/src/modules/game-api/src/*.cpp (state/entity/audio/...).
//   • Entities are addressed via the board target's class pool; `self` is
//     the current entity in that pool's iteration.
//
// The runtime never parses JSON: this string is sent through the editor-api
// hot-reload path. Persisted JSON stays in ProjectDoc.logicBoards.
// ---------------------------------------------------------------------------

import type {
  LogicBoard,
  LogicBoardDoc,
  LogicEvent,
} from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { usesTickFallback } from './trigger-execution'
import { assertBoardCompatible } from './trigger-compatibility'
import { INDENT, poolExpr, isGlobalTarget } from './lua-helpers'
import { logicBoardLuaCommentLabel } from './labels'
import {
  applyClickToDestroyTrigger,
  assertClickToDestroyCompatible,
} from './click-to-destroy'
import { buildEventSlugs } from './event-slugs'
import { emitEventRegistration } from './emit-event-registration'
import { buildHeader, buildTickWrapper } from './compiler-prelude'
import { derivePreludeFeatures } from './compiler-prelude-features'
import {
  pushDestroyTickBlock,
  pushMessageEventsInit,
  pushStartEventsInit,
  pushTickEventsBlock,
} from './emit-board-blocks'

// Re-export helpers consumed by compiler.test.ts and any future callers.
export { luaString, luaValue, targetExpr } from './lua-helpers'
export { conditionExpr } from './condition-expr'

function eventNeedsSensorEdge(
  ev: LogicEvent,
  board: LogicBoard,
  project: ProjectDoc | null | undefined,
): boolean {
  const type = ev.trigger.type
  if (type !== 'onTriggerEnter' && type !== 'onTriggerExit') return false
  return usesTickFallback(ev, board, project)
}

function eventNeedsDestroyBuffer(
  ev: LogicEvent,
  board: LogicBoard,
  project: ProjectDoc | null | undefined,
): boolean {
  return ev.trigger.type === 'onDestroy' && usesTickFallback(ev, board, project)
}

/**
 * Single walk over the doc that tells the tick wrapper which optional poll
 * preambles (sensor edge buffer, destroy queue) it needs to emit.
 */
function analyzePollingNeeds(
  doc: LogicBoardDoc,
  project: ProjectDoc | null | undefined,
): { useSensor: boolean; useDestroy: boolean } {
  let useSensor = false
  let useDestroy = false
  for (const board of doc) {
    for (const ev of board.events) {
      if (!ev.enabled) continue
      if (!useSensor && eventNeedsSensorEdge(ev, board, project)) useSensor = true
      if (!useDestroy && eventNeedsDestroyBuffer(ev, board, project)) useDestroy = true
      if (useSensor && useDestroy) return { useSensor, useDestroy }
    }
  }
  return { useSensor, useDestroy }
}

type BoardPartitions = {
  startEvents: LogicEvent[]
  messageEvents: LogicEvent[]
  registeredEvents: LogicEvent[]
  tickEvents: LogicEvent[]
  destroyTickEvents: LogicEvent[]
  pool: string
  isGlobal: boolean
}

type BoardEventBuckets = {
  startEvents: LogicEvent[]
  messageEvents: LogicEvent[]
  registeredEvents: LogicEvent[]
  tickFallback: LogicEvent[]
}

function classifyBoardEvent(
  ev: LogicEvent,
  board: LogicBoard,
  project: ProjectDoc | null | undefined,
  slugs: Map<string, string>,
  buckets: BoardEventBuckets,
): void {
  const kind = ev.trigger.type
  if (kind === 'onStart') {
    buckets.startEvents.push(ev)
    return
  }
  if (kind === 'onMessage' || kind === 'onDialogMessage') {
    buckets.messageEvents.push(ev)
    return
  }
  if (usesTickFallback(ev, board, project)) {
    buckets.tickFallback.push(ev)
    return
  }
  if (emitEventRegistration(ev, board, project, slugs)) {
    buckets.registeredEvents.push(ev)
  }
}

function partitionBoardEvents(
  board: LogicBoard,
  project: ProjectDoc | null | undefined,
  slugs: Map<string, string>,
): BoardPartitions {
  const enabled = board.events
    .filter((e) => e.enabled)
    .map((e) => applyClickToDestroyTrigger(e))
  const buckets: BoardEventBuckets = {
    startEvents: [],
    messageEvents: [],
    registeredEvents: [],
    tickFallback: [],
  }
  for (const ev of enabled) {
    classifyBoardEvent(ev, board, project, slugs, buckets)
  }

  return {
    startEvents: buckets.startEvents,
    messageEvents: buckets.messageEvents,
    registeredEvents: buckets.registeredEvents,
    tickEvents: buckets.tickFallback.filter((e) => e.trigger.type !== 'onDestroy'),
    destroyTickEvents: buckets.tickFallback.filter((e) => e.trigger.type === 'onDestroy'),
    pool: poolExpr(board.target, project),
    isGlobal: isGlobalTarget(board.target),
  }
}

function pushRegisteredInitEvents(
  init: string[],
  events: LogicEvent[],
  board: LogicBoard,
  project: ProjectDoc | null | undefined,
  slugs: Map<string, string>,
  logicDebugTrace: boolean,
): void {
  for (const ev of events) {
    const registration = emitEventRegistration(ev, board, project, slugs, logicDebugTrace)
    if (registration) init.push(...registration)
  }
}

/**
 * Build init- and tick-time Lua blocks for a single board. The slug map is
 * forwarded so guards inside both code paths use `RULE.<slug>` aliases.
 */
function emitBoard(
  board: LogicBoard,
  project: ProjectDoc | null | undefined,
  slugs: Map<string, string>,
  logicDebugTrace: boolean,
): { init: string[]; tick: string[] } {
  const parts = partitionBoardEvents(board, project, slugs)
  const init: string[] = []
  const tick: string[] = []

  pushStartEventsInit(init, parts.startEvents, board, parts.pool, parts.isGlobal, slugs, project, logicDebugTrace)
  pushMessageEventsInit(init, parts.messageEvents, board, parts.pool, parts.isGlobal, slugs, project, logicDebugTrace)
  pushRegisteredInitEvents(init, parts.registeredEvents, board, project, slugs, logicDebugTrace)
  pushTickEventsBlock(tick, parts.tickEvents, board, parts.pool, parts.isGlobal, slugs, project, logicDebugTrace)
  pushDestroyTickBlock(tick, parts.destroyTickEvents, board, slugs, project, logicDebugTrace)

  return { init, tick }
}

/**
 * Compile a full LogicBoardDoc into one Lua source string with a single
 * `tick(dt)` entry point (plus a one-shot init guard).
 */
export interface CompileLogicBoardOptions {
  logicDebugTrace?: boolean
}

export function compileLogicBoard(
  doc: LogicBoardDoc,
  project?: ProjectDoc | null,
  options?: CompileLogicBoardOptions,
): string {
  const logicDebugTrace = options?.logicDebugTrace === true
  const eventSlugs = buildEventSlugs(doc)

  const initBlocks: string[] = []
  const tickBlocks: string[] = []
  for (const board of doc) {
    assertBoardCompatible(board)
    assertClickToDestroyCompatible(board)
    const { init, tick } = emitBoard(board, project, eventSlugs, logicDebugTrace)
    const label = logicBoardLuaCommentLabel(board)
    if (init.length) {
      initBlocks.push(`${INDENT}-- board: ${label}`, ...init)
    }
    if (tick.length) {
      tickBlocks.push(`${INDENT}-- board: ${label}`, ...tick)
    }
  }

  const { useSensor, useDestroy } = analyzePollingNeeds(doc, project)
  const hasPollingLogic =
    tickBlocks.length > 0 || useSensor || useDestroy
  const preludeFeatures = derivePreludeFeatures(initBlocks, tickBlocks)

  const header = buildHeader(eventSlugs, preludeFeatures)
  const body = buildTickWrapper({
    tickBlocks,
    hasPollingLogic,
    useSensor,
    useDestroy,
    initBlocks,
    frameMovement: preludeFeatures.frameMovement,
  })

  return header.concat(body).join('\n')
}
