// ---------------------------------------------------------------------------
// Action emission — turn a LogicEvent's action list into Lua statements.
//
//   • emitActionSequence: linear actions, with `wait` splitting the tail into
//     a `time.after` callback so the game loop is never blocked.
//   • emitGuardedActions: wrap a sequence in the standard
//     `_logic_on[RULE.<slug>] ~= false and (<conditions>)` guard.
//
// All trigger-specific scaffolding (per-entity loops, sensor edges, mouse
// edge memory, timers) lives in emit-event-body.ts and uses these helpers.
// ---------------------------------------------------------------------------

import type { LogicAction, LogicEvent } from '../../types/logic-board'
import { INDENT } from './lua-helpers'
import { actionLua, WAIT_SENTINEL_PREFIX } from './action-emitter'
import { ruleKeyExpr } from './event-slugs'
import { conditionExpr } from './condition-expr'

/**
 * Emit actions in order; a `wait` splits the sequence — following actions (or
 * `wait.then`) run inside time.after so the game loop is not blocked.
 */
export function emitActionSequence(
  actions: LogicAction[],
  indent: string,
  slugs: Map<string, string>,
): string[] {
  if (actions.length === 0) return []

  const lines: string[] = []
  let i = 0
  const batch: LogicAction[] = []
  while (i < actions.length && actions[i].type !== 'wait') {
    batch.push(actions[i++])
  }
  for (const a of batch) {
    const code = actionLua(a, { eventSlugs: slugs })
    if (!code) continue
    // Drop only the wait-sentinel comment (wait is handled below via
    // time.after). Other comments — notably the "-- TODO ArtCade:
    // unknown action ..." marker the emitter falls back to on stale /
    // unrecognised action types — must reach the output so the issue
    // is visible in the generated Lua preview instead of being silently
    // discarded along with the action's behaviour.
    if (code.startsWith(WAIT_SENTINEL_PREFIX)) continue
    lines.push(indent + code)
  }

  if (i >= actions.length) return lines

  const w = actions[i]
  if (w.type !== 'wait') return lines

  const secs = Number(w.seconds) || 0
  // wait.then (optional sub-block from the schema) runs first inside the
  // time.after callback, followed by whatever the user put AFTER the wait in
  // the flat list. Earlier versions dropped the post-wait tail whenever
  // wait.then was non-empty — that was a latent bug since the editor never
  // populates wait.then today, but future UI work or hand-edited project
  // files would have silently lost actions.
  const deferred = [...(w.then ?? []), ...actions.slice(i + 1)]
  const inner = emitActionSequence(deferred, indent + INDENT, slugs)

  lines.push(`${indent}time.after(${secs}, function()`)
  lines.push(...inner)
  lines.push(`${indent}end)`)
  return lines
}

/**
 * Wrap an event's action sequence with its enable/condition guard. Returns
 * the bare sequence when the guard collapses to `true` (no conditions, no
 * enable check needed).
 */
export function emitGuardedActions(
  ev: LogicEvent,
  baseIndent: string,
  slugs: Map<string, string>,
): string[] {
  const enableGuard = `_logic_on[${ruleKeyExpr(ev.id, slugs)}] ~= false`
  const condGuard = conditionExpr(ev)
  const guard =
    condGuard === 'true' ? enableGuard : `${enableGuard} and (${condGuard})`

  if (guard === 'true')
    return emitActionSequence(ev.actions, baseIndent, slugs)

  return [
    `${baseIndent}if ${guard} then`,
    ...emitActionSequence(ev.actions, baseIndent + INDENT, slugs),
    `${baseIndent}end`,
  ]
}
