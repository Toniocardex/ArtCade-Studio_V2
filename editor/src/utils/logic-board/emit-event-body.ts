// ---------------------------------------------------------------------------
// Per-trigger inline body — the Lua statements that execute when an event's
// trigger fires. See file header in repo for scaffold types (tick, global, …).
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import { INDENT, luaPointerNearSelfExpr, luaString } from './lua-helpers'
import { onInputGateExpr } from './on-input-keys'
import { emitGuardedBranches } from './emit-guarded-branches'
import { ruleKeyExpr } from './event-slugs'

export function emitEventBody(
  ev: LogicEvent,
  board: LogicBoard,
  baseIndent: string,
  slugs: Map<string, string>,
): string[] {
  const lines: string[] = []
  const trig = ev.trigger
  const enableGuard = `_logic_on[${ruleKeyExpr(ev.id, slugs)}] ~= false`

  if (trig.type === 'onAnimationEnd') {
    return lines
  }

  if (trig.type === 'onSpawn') {
    return lines
  }

  if (trig.type === 'onDestroy') {
    lines.push(
      ...emitGuardedBranches(ev, baseIndent, slugs),
    )
    return lines
  }

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
    lines.push(
      `${baseIndent}${INDENT}if ${tagGuard} and ${edgeGuard} and ${enableGuard} then`,
    )
    lines.push(`${inner}other = se.otherId`)
    lines.push(
      ...emitGuardedBranches(ev, inner, slugs, { skipEnable: true }),
    )
    lines.push(`${baseIndent}${INDENT}end`)
    lines.push(`${baseIndent}end`)
    return lines
  }

  if (trig.type === 'onMouseInput') {
    const btn = trig.button === 'right' ? 1 : 0
    const prefix = luaString(`${board.boardId}:${ev.id}:`)
    const inner = baseIndent + INDENT
    lines.push(`${baseIndent}local _mbk = ${prefix} .. tostring(self)`)
    lines.push(`${baseIndent}local _mbcur = input.mouseButtonDown(${btn})`)
    const fire =
      trig.eventType === 'pressed'
        ? `_mbcur and not _mb[_mbk]`
        : trig.eventType === 'released'
          ? `(not _mbcur) and _mb[_mbk]`
          : `_mbcur`
    lines.push(`${baseIndent}if (${fire}) and ${enableGuard} then`)
    lines.push(
      ...emitGuardedBranches(ev, inner, slugs, { skipEnable: true }),
    )
    lines.push(`${baseIndent}end`)
    lines.push(`${baseIndent}_mb[_mbk] = _mbcur`)
    return lines
  }

  if (trig.type === 'onObjectClick') {
    const btn = trig.button === 'right' ? 1 : 0
    const hit = luaPointerNearSelfExpr(Number(trig.radius) || 32)
    const prefix = luaString(`${board.boardId}:${ev.id}:`)
    const inner = baseIndent + INDENT
    lines.push(`${baseIndent}local _ock = ${prefix} .. tostring(self)`)
    lines.push(`${baseIndent}local _ocur = input.mouseButtonDown(${btn})`)
    lines.push(`${baseIndent}local _ohit = ${hit}`)
    lines.push(
      `${baseIndent}if (_ocur and not _mb[_ock] and _ohit) and ${enableGuard} then`,
    )
    lines.push(
      ...emitGuardedBranches(ev, inner, slugs, { skipEnable: true }),
    )
    lines.push(`${baseIndent}end`)
    lines.push(`${baseIndent}_mb[_ock] = _ocur`)
    return lines
  }

  if (trig.type === 'onObjectHoverEnter' || trig.type === 'onObjectHoverExit') {
    const hit = luaPointerNearSelfExpr(Number(trig.radius) || 32)
    const prefix = luaString(`${board.boardId}:${ev.id}:hover:`)
    const wantEnter = trig.type === 'onObjectHoverEnter'
    const edge = wantEnter
      ? '(_ohit and not _mb[_ohk])'
      : '((not _ohit) and _mb[_ohk])'
    const inner = baseIndent + INDENT
    lines.push(`${baseIndent}local _ohk = ${prefix} .. tostring(self)`)
    lines.push(`${baseIndent}local _ohit = ${hit}`)
    lines.push(`${baseIndent}if ${edge} and ${enableGuard} then`)
    lines.push(
      ...emitGuardedBranches(ev, inner, slugs, { skipEnable: true }),
    )
    lines.push(`${baseIndent}end`)
    lines.push(`${baseIndent}_mb[_ohk] = _ohit`)
    return lines
  }

  let triggerGate: string | null = null
  if (trig.type === 'onCollision') {
    triggerGate = trig.withClass
      ? `collision.touchingClass(self, ${luaString(trig.withClass)})`
      : null
  } else if (trig.type === 'onCollisionEnter' || trig.type === 'onCollisionExit') {
    const wantEnter = trig.type === 'onCollisionEnter' ? 'true' : 'false'
    const withClass = trig.withClass?.trim() ?? ''
    triggerGate = withClass
      ? `_logic_collision_edge(self, ${luaString(withClass)}, ${wantEnter})`
      : null
    if (withClass) {
      lines.push(
        `${baseIndent}other = collision.firstTouching(self, ${luaString(withClass)})`,
      )
    }
    lines.push(
      ...emitGuardedBranches(ev, baseIndent, slugs, {
        triggerGate,
      }),
    )
    return lines
  } else if (trig.type === 'onInput') {
    triggerGate = onInputGateExpr(trig)
  } else if (trig.type === 'onTimer') {
    const prefix = luaString(`${board.boardId}:${ev.id}:`)
    const inner = baseIndent + INDENT
    const seconds = Number(trig.seconds) || 0
    lines.push(`${baseIndent}local _tk = ${prefix} .. tostring(self)`)
    lines.push(`${baseIndent}_logic_timers[_tk] = (_logic_timers[_tk] or 0) + dt`)
    lines.push(`${baseIndent}if _logic_timers[_tk] >= ${seconds} then`)
    if (trig.repeat) {
      lines.push(`${inner}_logic_timers[_tk] = _logic_timers[_tk] - ${seconds}`)
    } else {
      lines.push(`${inner}_logic_timers[_tk] = -math.huge`)
    }
    lines.push(`${inner}if ${enableGuard} then`)
    lines.push(
      ...emitGuardedBranches(ev, inner + INDENT, slugs, { skipEnable: true }),
    )
    lines.push(`${inner}end`)
    lines.push(`${baseIndent}end`)
    return lines
  }

  lines.push(
    ...emitGuardedBranches(ev, baseIndent, slugs, {
      triggerGate,
    }),
  )
  return lines
}
