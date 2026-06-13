// ---------------------------------------------------------------------------
// Per-trigger inline body — the Lua statements that execute when an event's
// trigger fires. See file header in repo for scaffold types (tick, global, …).
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent, LogicTrigger } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { INDENT, luaPointerNearSelfExpr, luaString } from './lua-helpers'
import { onInputGateExpr } from './on-input-keys'
import { emitGuardedBranches } from './emit-guarded-branches'
import { ruleKeyExpr } from './event-slugs'

type EmitCtx = {
  ev: LogicEvent
  board: LogicBoard
  baseIndent: string
  slugs: Map<string, string>
  project?: ProjectDoc | null
  enableGuard: string
  logicDebugTrace?: boolean
}

function enableGuardExpr(ev: LogicEvent, slugs: Map<string, string>): string {
  return `_logic_on[${ruleKeyExpr(ev.id, slugs)}] ~= false`
}

function emitGuarded(
  ctx: EmitCtx,
  indent: string,
  opts?: { triggerGate?: string | null; skipEnable?: boolean },
): string[] {
  return emitGuardedBranches(ctx.ev, indent, ctx.slugs, {
    ...opts,
    logicDebugTrace: ctx.logicDebugTrace,
  }, ctx.project)
}

function collisionWhileGate(trig: Extract<LogicTrigger, { type: 'onCollision' }>): string | null {
  const cls = trig.withClass?.trim()
  if (!cls) return null
  return `collision.touchingClass(self, ${luaString(cls)})`
}

function collisionEdgeGate(
  trig: Extract<LogicTrigger, { type: 'onCollisionEnter' } | { type: 'onCollisionExit' }>,
): { triggerGate: string | null; withClass: string } {
  const wantEnter = trig.type === 'onCollisionEnter' ? 'true' : 'false'
  const withClass = trig.withClass?.trim() ?? ''
  const triggerGate = withClass
    ? `_logic_collision_edge(self, ${luaString(withClass)}, ${wantEnter})`
    : null
  return { triggerGate, withClass }
}

function mouseButtonFireExpr(
  eventType: 'pressed' | 'down' | 'released',
): string {
  if (eventType === 'pressed') return '_mbcur and not _mb[_mbk]'
  if (eventType === 'released') return '(not _mbcur) and _mb[_mbk]'
  return '_mbcur'
}

function emitDestroyBody(ctx: EmitCtx): string[] {
  return emitGuarded(ctx, ctx.baseIndent)
}

function emitHealthDepletedBody(ctx: EmitCtx): string[] {
  const { baseIndent, slugs, ev } = ctx
  const slug = ruleKeyExpr(ev.id, slugs)
  const i1 = baseIndent + INDENT
  const i2 = i1 + INDENT
  const key = `${slug} .. ":" .. tostring(self)`
  return [
    `${baseIndent}do`,
    `${i1}local _hc, _ = entity.health(self)`,
    `${i1}if _hc ~= nil then`,
    `${i2}if _hc <= 0 and not _hpd_fired[${key}] then`,
    `${i2}${INDENT}_hpd_fired[${key}] = true`,
    ...emitGuarded(ctx, i2 + INDENT),
    `${i2}elseif _hc > 0 then`,
    `${i2}${INDENT}_hpd_fired[${key}] = nil`,
    `${i2}end`,
    `${i1}end`,
    `${baseIndent}end`,
  ]
}

function emitDamagedBody(ctx: EmitCtx): string[] {
  const { baseIndent, slugs, ev } = ctx
  const slug = ruleKeyExpr(ev.id, slugs)
  const i1 = baseIndent + INDENT
  const i2 = i1 + INDENT
  const key = `${slug} .. ":" .. tostring(self)`
  return [
    `${baseIndent}do`,
    `${i1}local _hc, _ = entity.health(self)`,
    `${i1}if _hc ~= nil then`,
    `${i2}local _prev = _dmg_prev[${key}]`,
    `${i2}_dmg_prev[${key}] = _hc`,
    `${i2}if _prev ~= nil and _hc < _prev then`,
    ...emitGuarded(ctx, i2 + INDENT),
    `${i2}end`,
    `${i1}end`,
    `${baseIndent}end`,
  ]
}

function emitLeaveScreenBody(ctx: EmitCtx): string[] {
  const { baseIndent, slugs, ev } = ctx
  const slug = ruleKeyExpr(ev.id, slugs)
  const i1 = baseIndent + INDENT
  const key = `${slug} .. ":" .. tostring(self)`
  return [
    `${baseIndent}do`,
    `${i1}local _off = screen.isOffScreen(self)`,
    `${i1}if _off and not _ls_prev[${key}] then`,
    ...emitGuarded(ctx, i1 + INDENT),
    `${i1}end`,
    `${i1}_ls_prev[${key}] = _off`,
    `${baseIndent}end`,
  ]
}

function emitSensorTriggerBody(
  ctx: EmitCtx,
  trig: Extract<LogicTrigger, { type: 'onTriggerEnter' } | { type: 'onTriggerExit' }>,
): string[] {
  const { baseIndent, enableGuard } = ctx
  const inner = baseIndent + INDENT
  const tagGuard = trig.withClass
    ? `se.tag == ${luaString(trig.withClass)}`
    : 'true'
  const edgeGuard = trig.type === 'onTriggerEnter' ? 'se.enter' : '(not se.enter)'
  return [
    `${baseIndent}for _, se in ipairs(_sensor_by_ent[self] or {}) do`,
    `${baseIndent}${INDENT}if ${tagGuard} and ${edgeGuard} and ${enableGuard} then`,
    `${inner}other = se.otherId`,
    ...emitGuarded(ctx, inner, { skipEnable: true }),
    `${baseIndent}${INDENT}end`,
    `${baseIndent}end`,
  ]
}

function emitMouseInputBody(
  ctx: EmitCtx,
  trig: Extract<LogicTrigger, { type: 'onMouseInput' }>,
): string[] {
  const { ev, board, baseIndent, enableGuard } = ctx
  const btn = trig.button === 'right' ? 1 : 0
  const prefix = luaString(`${board.boardId}:${ev.id}:`)
  const inner = baseIndent + INDENT
  const fire = mouseButtonFireExpr(trig.eventType)
  return [
    `${baseIndent}local _mbk = ${prefix} .. tostring(self)`,
    `${baseIndent}local _mbcur = input.mouseButtonDown(${btn})`,
    `${baseIndent}if (${fire}) and ${enableGuard} then`,
    ...emitGuarded(ctx, inner, { skipEnable: true }),
    `${baseIndent}end`,
    `${baseIndent}_mb[_mbk] = _mbcur`,
  ]
}

function emitObjectClickBody(
  ctx: EmitCtx,
  trig: Extract<LogicTrigger, { type: 'onObjectClick' }>,
): string[] {
  const { ev, board, baseIndent, enableGuard } = ctx
  const btn = trig.button === 'right' ? 1 : 0
  const hit = luaPointerNearSelfExpr(Number(trig.radius) || 32)
  const prefix = luaString(`${board.boardId}:${ev.id}:`)
  const inner = baseIndent + INDENT
  return [
    `${baseIndent}local _ock = ${prefix} .. tostring(self)`,
    `${baseIndent}local _ocur = input.mouseButtonDown(${btn})`,
    `${baseIndent}local _ohit = ${hit}`,
    `${baseIndent}if (_ocur and not _mb[_ock] and _ohit) and ${enableGuard} then`,
    ...emitGuarded(ctx, inner, { skipEnable: true }),
    `${baseIndent}end`,
    `${baseIndent}_mb[_ock] = _ocur`,
  ]
}

function emitObjectHoverBody(
  ctx: EmitCtx,
  trig: Extract<LogicTrigger, { type: 'onObjectHoverEnter' } | { type: 'onObjectHoverExit' }>,
): string[] {
  const { ev, board, baseIndent, enableGuard } = ctx
  const hit = luaPointerNearSelfExpr(Number(trig.radius) || 32)
  const prefix = luaString(`${board.boardId}:${ev.id}:hover:`)
  const wantEnter = trig.type === 'onObjectHoverEnter'
  const edge = wantEnter
    ? '(_ohit and not _mb[_ohk])'
    : '((not _ohit) and _mb[_ohk])'
  const inner = baseIndent + INDENT
  return [
    `${baseIndent}local _ohk = ${prefix} .. tostring(self)`,
    `${baseIndent}local _ohit = ${hit}`,
    `${baseIndent}if ${edge} and ${enableGuard} then`,
    ...emitGuarded(ctx, inner, { skipEnable: true }),
    `${baseIndent}end`,
    `${baseIndent}_mb[_ohk] = _ohit`,
  ]
}

function emitCollisionEdgeBody(
  ctx: EmitCtx,
  trig: Extract<LogicTrigger, { type: 'onCollisionEnter' } | { type: 'onCollisionExit' }>,
): string[] {
  const { baseIndent } = ctx
  const { triggerGate, withClass } = collisionEdgeGate(trig)
  const lines: string[] = []
  if (withClass) {
    lines.push(
      `${baseIndent}other = collision.firstTouching(self, ${luaString(withClass)})`,
    )
  }
  lines.push(...emitGuarded(ctx, baseIndent, { triggerGate }))
  return lines
}

function emitTimerBody(
  ctx: EmitCtx,
  trig: Extract<LogicTrigger, { type: 'onTimer' }>,
): string[] {
  const { ev, board, baseIndent, enableGuard } = ctx
  const prefix = luaString(`${board.boardId}:${ev.id}:`)
  const inner = baseIndent + INDENT
  const seconds = Number(trig.seconds) || 0
  const timerReset = trig.repeat
    ? `${inner}_logic_timers[_tk] = _logic_timers[_tk] - ${seconds}`
    : `${inner}_logic_timers[_tk] = -math.huge`
  return [
    `${baseIndent}local _tk = ${prefix} .. tostring(self)`,
    `${baseIndent}_logic_timers[_tk] = (_logic_timers[_tk] or 0) + dt`,
    `${baseIndent}if _logic_timers[_tk] >= ${seconds} then`,
    timerReset,
    `${inner}if ${enableGuard} then`,
    ...emitGuarded(ctx, inner + INDENT, { skipEnable: true }),
    `${inner}end`,
    `${baseIndent}end`,
  ]
}

function simpleTriggerGate(trig: LogicTrigger): string | null {
  if (trig.type === 'onCollision') return collisionWhileGate(trig)
  if (trig.type === 'onInput') return onInputGateExpr(trig)
  return null
}

function emitSimpleGatedBody(ctx: EmitCtx, trig: LogicTrigger): string[] {
  return emitGuarded(ctx, ctx.baseIndent, { triggerGate: simpleTriggerGate(trig) })
}

export function emitEventBody(
  ev: LogicEvent,
  board: LogicBoard,
  baseIndent: string,
  slugs: Map<string, string>,
  project?: ProjectDoc | null,
  logicDebugTrace?: boolean,
): string[] {
  const trig = ev.trigger
  const ctx: EmitCtx = {
    ev,
    board,
    baseIndent,
    slugs,
    project,
    enableGuard: enableGuardExpr(ev, slugs),
    logicDebugTrace,
  }

  switch (trig.type) {
    case 'onAnimationEnd':
    case 'onSpawn':
      return []
    case 'onDestroy':
      return emitDestroyBody(ctx)
    case 'onHealthDepleted':
      return emitHealthDepletedBody(ctx)
    case 'onDamaged':
      return emitDamagedBody(ctx)
    case 'onLeaveScreen':
      return emitLeaveScreenBody(ctx)
    case 'onTriggerEnter':
    case 'onTriggerExit':
      return emitSensorTriggerBody(ctx, trig)
    case 'onMouseInput':
      return emitMouseInputBody(ctx, trig)
    case 'onObjectClick':
      return emitObjectClickBody(ctx, trig)
    case 'onObjectHoverEnter':
    case 'onObjectHoverExit':
      return emitObjectHoverBody(ctx, trig)
    case 'onCollisionEnter':
    case 'onCollisionExit':
      return emitCollisionEdgeBody(ctx, trig)
    case 'onTimer':
      return emitTimerBody(ctx, trig)
    default:
      return emitSimpleGatedBody(ctx, trig)
  }
}
