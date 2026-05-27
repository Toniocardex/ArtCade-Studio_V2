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
} from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { usesTickFallback } from './trigger-execution'
import { assertBoardCompatible } from './trigger-compatibility'
import { INDENT, poolExpr, luaString, isGlobalTarget } from './lua-helpers'
import { logicBoardLuaCommentLabel } from './labels'
import {
  applyClickToDestroyTrigger,
  assertClickToDestroyCompatible,
} from './click-to-destroy'
import { buildEventSlugs } from './event-slugs'
import { emitEventBody } from './emit-event-body'
import { emitEventRegistration } from './emit-event-registration'
import { buildHeader, buildTickWrapper } from './compiler-prelude'

// Re-export helpers consumed by compiler.test.ts and any future callers.
export { luaString, luaValue, targetExpr } from './lua-helpers'
export { conditionExpr } from './condition-expr'

/**
 * Single walk over the doc that tells the tick wrapper which optional poll
 * preambles (sensor edge buffer, destroy queue) it needs to emit. Replaces
 * three separate scans of the same data.
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
      if (useSensor && useDestroy) return { useSensor, useDestroy }
      const type = ev.trigger.type
      if (
        (type === 'onTriggerEnter' || type === 'onTriggerExit') &&
        !useSensor &&
        usesTickFallback(ev, board, project)
      ) {
        useSensor = true
        continue
      }
      if (type === 'onDestroy' && !useDestroy && usesTickFallback(ev, board, project)) {
        useDestroy = true
      }
    }
  }
  return { useSensor, useDestroy }
}

/**
 * Build init- and tick-time Lua blocks for a single board. The slug map is
 * forwarded so guards inside both code paths use `RULE.<slug>` aliases.
 */
function emitBoard(
  board: LogicBoard,
  project: ProjectDoc | null | undefined,
  slugs: Map<string, string>,
): { init: string[]; tick: string[] } {
  const enabled = board.events
    .filter((e) => e.enabled)
    .map((e) => applyClickToDestroyTrigger(e))
  const startEvents = enabled.filter((e) => e.trigger.type === 'onStart')
  const messageEvents = enabled.filter((e) => e.trigger.type === 'onMessage')
  const registeredEvents = enabled.filter((e) => {
    if (e.trigger.type === 'onStart' || e.trigger.type === 'onMessage') return false
    if (usesTickFallback(e, board, project)) return false
    return emitEventRegistration(e, board, project, slugs) !== null
  })
  const allTickEvents = enabled.filter((e) => usesTickFallback(e, board, project))
  // onDestroy fallback runs against `_destroy_events`, not the live pool
  // (destroyed entities aren't in pool.getAll). Hoist it out of the per-pool
  // loop so it iterates the destroy buffer once with `self = de.entityId`.
  const destroyTickEvents = allTickEvents.filter((e) => e.trigger.type === 'onDestroy')
  const tickEvents = allTickEvents.filter((e) => e.trigger.type !== 'onDestroy')

  const pool = poolExpr(board.target)
  const isGlobal = isGlobalTarget(board.target)
  const init: string[] = []
  const tick: string[] = []

  if (startEvents.length > 0) {
    if (isGlobal) {
      // Global boards have no entity context — single execution block.
      init.push(`${INDENT}do`)
      init.push(`${INDENT}${INDENT}local self = nil`)
      init.push(`${INDENT}${INDENT}local other = nil`)
      for (const ev of startEvents) {
        init.push(...emitEventBody(ev, board, INDENT + INDENT, slugs))
      }
      init.push(`${INDENT}end`)
    } else {
      init.push(`${INDENT}for _, self in ipairs(${pool}) do`)
      for (const ev of startEvents) {
        init.push(...emitEventBody(ev, board, INDENT + INDENT, slugs))
      }
      init.push(`${INDENT}end`)
    }
  }

  // onMessage → register an event.on listener once in init.
  for (const ev of messageEvents) {
    if (ev.trigger.type !== 'onMessage') continue
    const I = INDENT
    init.push(`${I}_logic_reg_message(${luaString(ev.trigger.messageName)}, function()`)
    if (isGlobal) {
      init.push(`${I}${I}local self = nil`)
      init.push(`${I}${I}local other = nil`)
      init.push(...emitEventBody(ev, board, I + I, slugs))
    } else {
      init.push(`${I}${I}for _, self in ipairs(${pool}) do`)
      init.push(`${I}${I}${I}local other = nil`)
      init.push(...emitEventBody(ev, board, I + I + I, slugs))
      init.push(`${I}${I}end`)
    }
    init.push(`${I}end)`)
  }

  for (const ev of registeredEvents) {
    const registration = emitEventRegistration(ev, board, project, slugs)
    if (registration) init.push(...registration)
  }

  if (tickEvents.length > 0) {
    if (isGlobal) {
      tick.push(`${INDENT}do`)
      tick.push(`${INDENT}${INDENT}local self = nil`)
      tick.push(`${INDENT}${INDENT}local other = nil`)
      for (const ev of tickEvents) {
        tick.push(...emitEventBody(ev, board, INDENT + INDENT, slugs))
      }
      tick.push(`${INDENT}end`)
    } else {
      tick.push(`${INDENT}for _, self in ipairs(${pool}) do`)
      tick.push(`${INDENT}${INDENT}local other = nil`)
      for (const ev of tickEvents) {
        tick.push(...emitEventBody(ev, board, INDENT + INDENT, slugs))
      }
      tick.push(`${INDENT}end`)
    }
  }

  if (destroyTickEvents.length > 0) {
    tick.push(`${INDENT}for _, de in ipairs(_destroy_events) do`)
    tick.push(`${INDENT}${INDENT}local self = de.entityId`)
    tick.push(`${INDENT}${INDENT}local other = nil`)
    for (const ev of destroyTickEvents) {
      tick.push(...emitEventBody(ev, board, INDENT + INDENT, slugs))
    }
    tick.push(`${INDENT}end`)
  }

  return { init, tick }
}

/**
 * Compile a full LogicBoardDoc into one Lua source string with a single
 * `tick(dt)` entry point (plus a one-shot init guard).
 */
export function compileLogicBoard(
  doc: LogicBoardDoc,
  project?: ProjectDoc | null,
): string {
  const eventSlugs = buildEventSlugs(doc)

  const initBlocks: string[] = []
  const tickBlocks: string[] = []
  for (const board of doc) {
    // Fail loudly on incompatible trigger/target combos so the editor
    // surfaces the error instead of producing broken Lua.
    assertBoardCompatible(board)
    assertClickToDestroyCompatible(board)
    const { init, tick } = emitBoard(board, project, eventSlugs)
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

  const header = buildHeader(eventSlugs)
  const body = buildTickWrapper({
    tickBlocks,
    hasPollingLogic,
    useSensor,
    useDestroy,
    initBlocks,
  })

  return header.concat(body).join('\n')
}
