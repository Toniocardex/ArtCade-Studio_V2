// ---------------------------------------------------------------------------
// Per-trigger inline body — the Lua statements that execute when an event's
// trigger fires. The body is emitted into one of four scaffolds chosen by
// compiler.ts based on board target + trigger type:
//
//   1) Per-entity `tick(dt)` loop — `for _, self in ipairs(pool)`. Default
//      for entity_class / entity_id boards.
//   2) Single nil-self block — `do local self = nil ... end`. Used for
//      global boards (target.type='global') where there is no entity
//      context. Actions targeting `self` are intentionally inert.
//   3) Per-destroy-event loop — `for _, de in ipairs(_destroy_events) do
//      local self = de.entityId`. Hoisted by compiler.ts so onDestroy
//      tick-fallback can react to entities that are no longer in the pool.
//   4) onMessage / onStart wrappers in init — same shapes as (1) or (2)
//      depending on isGlobal.
//
// This file is the big switch on `LogicTrigger.type`: each case shapes the
// Lua scaffolding around the action sequence (sensor edge polling, mouse
// button memory, timer accumulators, etc). Trigger handlers that register
// a callback in init instead live in emit-event-registration.ts.
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import { INDENT, luaString } from './lua-helpers'
import { conditionExpr } from './condition-expr'
import { emitActionSequence } from './emit-actions'
import { ruleKeyExpr } from './event-slugs'

export function emitEventBody(
  ev: LogicEvent,
  board: LogicBoard,
  baseIndent: string,
  slugs: Map<string, string>,
): string[] {
  const lines: string[] = []
  const trig = ev.trigger

  // Every event is gated by its toggleLogicEvent enable flag (default on).
  const enableGuard = `_logic_on[${ruleKeyExpr(ev.id, slugs)}] ~= false`
  const condGuard = conditionExpr(ev)
  const guard =
    condGuard === 'true' ? enableGuard : `${enableGuard} and (${condGuard})`

  if (trig.type === 'onAnimationEnd') {
    // Registered in init via animation.onFinished — no tick body.
    return lines
  }

  if (trig.type === 'onSpawn') {
    // Always registered via lifecycle.onSpawn (usesTickFallback returns
    // false for onSpawn). If we ever land here, emit nothing — the old
    // generic gate path made onSpawn fire every frame. Belt-and-suspenders
    // for any future code path that calls this function with onSpawn.
    return lines
  }

  if (trig.type === 'onDestroy') {
    // Fallback path only. Iteration scaffolding (for de in _destroy_events do
    // local self = de.entityId ...) is emitted by compiler.ts so this body
    // runs once per destroy event with `self` already bound — the old
    // version sat inside a `for self in pool.getAll(...)` loop that excludes
    // destroyed entities, so the match `de.entityId == self` was never true.
    if (guard === 'true') {
      lines.push(...emitActionSequence(ev.actions, baseIndent, slugs))
    } else {
      lines.push(`${baseIndent}if ${guard} then`)
      lines.push(...emitActionSequence(ev.actions, baseIndent + INDENT, slugs))
      lines.push(`${baseIndent}end`)
    }
    return lines
  }

  // onTriggerEnter / onTriggerExit: edges from sensor.poll() (indexed in _sensor_by_ent).
  if (trig.type === 'onTriggerEnter' || trig.type === 'onTriggerExit') {
    const inner = baseIndent + INDENT
    const tagGuard = trig.withClass
      ? `se.tag == ${luaString(trig.withClass)}`
      : 'true'
    const edgeGuard =
      trig.type === 'onTriggerEnter' ? 'se.enter' : '(not se.enter)'
    lines.push(
      `${baseIndent}for _, se in ipairs(_sensor_by_ent[self] or {}) do`,
    )
    lines.push(`${baseIndent}${INDENT}if ${tagGuard} and ${edgeGuard} and ${guard} then`)
    lines.push(`${baseIndent}${INDENT}${INDENT}other = se.otherId`)
    lines.push(...emitActionSequence(ev.actions, inner + INDENT, slugs))
    lines.push(`${baseIndent}${INDENT}end`)
    lines.push(`${baseIndent}end`)
    return lines
  }

  // onMouseInput: edge/level detection with per-event-and-entity memory.
  // The key includes `self` so each pool entry tracks its own pressed/released
  // edge; without it, only the first entity ever saw the rising edge because
  // _mb[boardId:eventId] was set true after the first iteration.
  if (trig.type === 'onMouseInput') {
    const btn = trig.button === 'right' ? 1 : 0
    const prefix = luaString(`${board.boardId}:${ev.id}:`)
    const inner = baseIndent + INDENT
    lines.push(`${baseIndent}local _mbk = ${prefix} .. tostring(self)`)
    lines.push(`${baseIndent}local _mbcur = input.mouseButtonDown(${btn})`)
    const fire =
      trig.eventType === 'pressed' ? `_mbcur and not _mb[_mbk]`
      : trig.eventType === 'released' ? `(not _mbcur) and _mb[_mbk]`
      : `_mbcur`
    lines.push(`${baseIndent}if (${fire}) and ${guard} then`)
    lines.push(...emitActionSequence(ev.actions, inner, slugs))
    lines.push(`${baseIndent}end`)
    lines.push(`${baseIndent}_mb[_mbk] = _mbcur`)
    return lines
  }

  // Trigger-specific gating expression layered on top of the condition guard.
  let gate: string | null = null
  if (trig.type === 'onCollision') {
    gate = trig.withClass
      ? `collision.touchingClass(self, ${luaString(trig.withClass)})`
      : null
  } else if (trig.type === 'onInput') {
    const fn =
      trig.eventType === 'pressed'
        ? 'wasKeyPressed'
        : trig.eventType === 'released'
          ? 'wasKeyReleased'
          : 'isKeyDown'
    gate = `input.${fn}(${luaString(trig.keyCode)})`
  } else if (trig.type === 'onTimer') {
    // Per-instance key: appending `self` so each entity in a class-targeted
    // board has its own accumulator. Without `self`, a "every 2s" rule on
    // 50 enemies would share one timer that fires once for the whole pool.
    const prefix = luaString(`${board.boardId}:${ev.id}:`)
    const inner = baseIndent + INDENT
    const seconds = Number(trig.seconds) || 0
    lines.push(`${baseIndent}local _tk = ${prefix} .. tostring(self)`)
    lines.push(`${baseIndent}_logic_timers[_tk] = (_logic_timers[_tk] or 0) + dt`)
    lines.push(`${baseIndent}if _logic_timers[_tk] >= ${seconds} then`)
    if (trig.repeat) {
      // Repeat: subtract the interval (not reset to 0) so accumulated overshoot
      // carries forward and the average rate matches the requested period.
      lines.push(`${inner}_logic_timers[_tk] = _logic_timers[_tk] - ${seconds}`)
    } else {
      // One-shot: park the counter at -math.huge so the threshold can never
      // be crossed again. Without this guard, the timer would fire every
      // subsequent frame because the accumulator keeps growing.
      lines.push(`${inner}_logic_timers[_tk] = -math.huge`)
    }
    if (guard === 'true') {
      lines.push(...emitActionSequence(ev.actions, inner, slugs))
    } else {
      lines.push(`${inner}if ${guard} then`)
      lines.push(...emitActionSequence(ev.actions, inner + INDENT, slugs))
      lines.push(`${inner}end`)
    }
    lines.push(`${baseIndent}end`)
    return lines
  }

  const fullGuard =
    gate && guard !== 'true'
      ? `${gate} and (${guard})`
      : gate
        ? gate
        : guard

  if (fullGuard === 'true') {
    lines.push(...emitActionSequence(ev.actions, baseIndent, slugs))
  } else {
    lines.push(`${baseIndent}if ${fullGuard} then`)
    lines.push(...emitActionSequence(ev.actions, baseIndent + INDENT, slugs))
    lines.push(`${baseIndent}end`)
  }
  return lines
}
