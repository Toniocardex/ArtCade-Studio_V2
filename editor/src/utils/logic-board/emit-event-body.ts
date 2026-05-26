// ---------------------------------------------------------------------------
// Per-trigger inline body — code that runs inside the per-entity `tick(dt)`
// loop (or inside a synthesised onMessage / onStart loop in init).
//
// This is the big switch on `LogicTrigger.type`: each case shapes the Lua
// scaffolding around the action sequence (sensor edge polling, mouse button
// memory, timer accumulators, etc). Trigger handlers that register a callback
// in init instead live in emit-event-registration.ts.
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

  // onMouseInput: edge/level detection with per-event memory in _mb.
  if (trig.type === 'onMouseInput') {
    const btn = trig.button === 'right' ? 1 : 0
    const key = luaString(`${board.boardId}:${ev.id}`)
    const inner = baseIndent + INDENT
    lines.push(`${baseIndent}local _mbcur = input.mouseButtonDown(${btn})`)
    const fire =
      trig.eventType === 'pressed' ? `_mbcur and not _mb[${key}]`
      : trig.eventType === 'released' ? `(not _mbcur) and _mb[${key}]`
      : `_mbcur`
    lines.push(`${baseIndent}if (${fire}) and ${guard} then`)
    lines.push(...emitActionSequence(ev.actions, inner, slugs))
    lines.push(`${baseIndent}end`)
    lines.push(`${baseIndent}_mb[${key}] = _mbcur`)
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
    const key = luaString(`${board.boardId}:${ev.id}`)
    const inner = baseIndent + INDENT
    const seconds = Number(trig.seconds) || 0
    lines.push(`${baseIndent}_logic_timers[${key}] = (_logic_timers[${key}] or 0) + dt`)
    lines.push(`${baseIndent}if _logic_timers[${key}] >= ${seconds} then`)
    if (trig.repeat) {
      // Repeat: subtract the interval (not reset to 0) so accumulated overshoot
      // carries forward and the average rate matches the requested period.
      lines.push(`${inner}_logic_timers[${key}] = _logic_timers[${key}] - ${seconds}`)
    } else {
      // One-shot: park the counter at -math.huge so the threshold can never
      // be crossed again. Without this guard, the timer would fire every
      // subsequent frame because the accumulator keeps growing.
      lines.push(`${inner}_logic_timers[${key}] = -math.huge`)
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
