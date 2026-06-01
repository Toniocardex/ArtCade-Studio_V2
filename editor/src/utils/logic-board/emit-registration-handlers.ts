// ---------------------------------------------------------------------------
// Per-trigger init registration emitters (emit-event-registration.ts).
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { INDENT, luaString } from './lua-helpers'
import {
  getKeyCombine,
  getOnInputKeyCodes,
  getOnInputRegistrationKeys,
  onInputGateExpr,
  onInputUsesPolling,
} from './on-input-keys'
import { boardLifecycleClass } from './trigger-execution'
import { emitGuardedActions } from './emit-actions'

type EmitCtx = {
  ev: LogicEvent
  board: LogicBoard
  project: ProjectDoc | null | undefined
  slugs: Map<string, string>
  pool: string
  source: string
  isGlobal: boolean
  logicDebugTrace?: boolean
}

function lifecycleHandlerLines(
  ev: LogicEvent,
  slugs: Map<string, string>,
  project: ProjectDoc | null | undefined,
  open: string,
  close: string,
  logicDebugTrace?: boolean,
): string[] {
  const I = INDENT
  return [
    open,
    `${I}${I}local self = entityId`,
    `${I}${I}local other = nil`,
    ...emitGuardedActions(ev, I + I, slugs, null, project, logicDebugTrace),
    close,
  ]
}

export function emitSpawnRegistration(ctx: EmitCtx): string[] | null {
  if (ctx.ev.trigger.type !== 'onSpawn') return null
  const cls = boardLifecycleClass(ctx.board, ctx.ev, ctx.project)
  if (!cls) return null
  const I = INDENT
  return lifecycleHandlerLines(
    ctx.ev,
    ctx.slugs,
    ctx.project,
    `${I}_logic_reg_spawn(${luaString(cls)}, function(entityId, tags)`,
    `${I}end)`,
    ctx.logicDebugTrace,
  )
}

export function emitDestroyRegistration(ctx: EmitCtx): string[] | null {
  if (ctx.ev.trigger.type !== 'onDestroy') return null
  const cls = boardLifecycleClass(ctx.board, ctx.ev, ctx.project)
  if (!cls) return null
  const I = INDENT
  return lifecycleHandlerLines(
    ctx.ev,
    ctx.slugs,
    ctx.project,
    `${I}_logic_reg_destroy(${luaString(cls)}, function(entityId, tags)`,
    `${I}end)`,
    ctx.logicDebugTrace,
  )
}

export function emitAnimationEndRegistration(ctx: EmitCtx): string[] | null {
  const trig = ctx.ev.trigger
  if (trig.type !== 'onAnimationEnd') return null
  const clip =
    trig.clipName && trig.clipName.length > 0
      ? luaString(trig.clipName)
      : luaString('*')
  const I = INDENT
  return lifecycleHandlerLines(
    ctx.ev,
    ctx.slugs,
    ctx.project,
    `${I}_logic_reg_anim_end(${ctx.source}, ${clip}, function(entityId, clip)`,
    `${I}end)`,
    ctx.logicDebugTrace,
  )
}

function pushInputRegistrationBlock(
  lines: string[],
  helper: string,
  keyCode: string,
  ctx: EmitCtx,
  inputGate: string | null,
): void {
  const I = INDENT
  if (ctx.isGlobal) {
    lines.push(
      `${I}${helper}(${luaString(keyCode)}, function()`,
      `${I}${I}local self = nil`,
      `${I}${I}local other = nil`,
      ...emitGuardedActions(ctx.ev, I + I, ctx.slugs, inputGate, ctx.project, ctx.logicDebugTrace),
      `${I}end)`,
    )
    return
  }
  lines.push(
    `${I}${helper}(${luaString(keyCode)}, function()`,
    `${I}${I}for _, self in ipairs(${ctx.pool}) do`,
    `${I}${I}${I}local other = nil`,
    ...emitGuardedActions(ctx.ev, I + I + I, ctx.slugs, inputGate, ctx.project, ctx.logicDebugTrace),
    `${I}${I}end`,
    `${I}end)`,
  )
}

export function emitOnInputRegistration(ctx: EmitCtx): string[] | null {
  const trig = ctx.ev.trigger
  if (trig.type !== 'onInput' || trig.eventType === 'down' || onInputUsesPolling(trig)) {
    return null
  }
  const helper =
    trig.eventType === 'pressed' ? '_logic_reg_input_pressed' : '_logic_reg_input_released'
  const codes = getOnInputKeyCodes(trig)
  const inputGate =
    getKeyCombine(trig) === 'AND' && codes.length > 1 ? onInputGateExpr(trig) : null
  const lines: string[] = []
  for (const keyCode of getOnInputRegistrationKeys(trig)) {
    pushInputRegistrationBlock(lines, helper, keyCode, ctx, inputGate)
  }
  return lines
}

export function emitSensorRegistration(ctx: EmitCtx): string[] | null {
  const trig = ctx.ev.trigger
  if (trig.type !== 'onTriggerEnter' && trig.type !== 'onTriggerExit') return null
  const helper =
    trig.type === 'onTriggerEnter' ? '_logic_reg_sensor_enter' : '_logic_reg_sensor_exit'
  const target = trig.withClass ? luaString(trig.withClass) : luaString('*')
  const I = INDENT
  return [
    `${I}${helper}(${ctx.source}, ${target}, function(entityId, otherId, tag)`,
    `${I}${I}local self = entityId`,
    `${I}${I}local other = otherId`,
    ...emitGuardedActions(ctx.ev, I + I, ctx.slugs, null, ctx.project, ctx.logicDebugTrace),
    `${I}end)`,
  ]
}

function timerCallbackLines(ctx: EmitCtx): string[] {
  const I = INDENT
  if (ctx.isGlobal) {
    return [
      `${I}${I}local self = nil`,
      `${I}${I}local other = nil`,
      ...emitGuardedActions(ctx.ev, I + I, ctx.slugs, null, ctx.project, ctx.logicDebugTrace),
    ]
  }
  return [
    `${I}${I}for _, self in ipairs(${ctx.pool}) do`,
    `${I}${I}${I}local other = nil`,
    ...emitGuardedActions(ctx.ev, I + I + I, ctx.slugs, null, ctx.project, ctx.logicDebugTrace),
    `${I}${I}end`,
  ]
}

export function emitTimerRegistration(ctx: EmitCtx): string[] | null {
  const trig = ctx.ev.trigger
  if (trig.type !== 'onTimer') return null
  const helper = trig.repeat ? '_logic_reg_timer_every' : '_logic_reg_timer_after'
  const I = INDENT
  const seconds = Number(trig.seconds) || 0
  return [
    `${I}${helper}(${seconds}, function()`,
    ...timerCallbackLines(ctx),
    `${I}end)`,
  ]
}
