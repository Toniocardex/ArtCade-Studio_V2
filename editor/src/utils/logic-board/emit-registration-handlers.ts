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

/** Lua expression for an animation trigger's clip filter ("*" = any clip). */
function animClipExpr(clipName: string | undefined): string {
  return clipName && clipName.length > 0 ? luaString(clipName) : luaString('*')
}

/**
 * Animation triggers whose handler is a plain `(entityId, clip)` closure with
 * no extra filtering, keyed by the prelude helper that registers them. Frame
 * is excluded — it needs an in-closure frame guard (see below).
 */
const ANIM_LIFECYCLE_HELPERS: Partial<Record<LogicEvent['trigger']['type'], string>> = {
  onAnimationEnd: '_logic_reg_anim_end',
  onAnimationStart: '_logic_reg_anim_start',
  onAnimationLoop: '_logic_reg_anim_loop',
  onAnimationChange: '_logic_reg_anim_change',
}

export function emitAnimationLifecycleRegistration(ctx: EmitCtx): string[] | null {
  const trig = ctx.ev.trigger
  const helper = ANIM_LIFECYCLE_HELPERS[trig.type]
  if (!helper) return null
  const clipName = 'clipName' in trig ? trig.clipName : undefined
  const I = INDENT
  return lifecycleHandlerLines(
    ctx.ev,
    ctx.slugs,
    ctx.project,
    `${I}${helper}(${ctx.source}, ${animClipExpr(clipName)}, function(entityId, clip)`,
    `${I}end)`,
    ctx.logicDebugTrace,
  )
}

export function emitAnimationFrameRegistration(ctx: EmitCtx): string[] | null {
  const trig = ctx.ev.trigger
  if (trig.type !== 'onAnimationFrame') return null
  // The runtime fires onFrame on every frame advance; filter to the target
  // frame inside the closure so C++ stays clip/frame-agnostic.
  const target = Math.max(0, Math.floor(Number(trig.frameIndex) || 0))
  const I = INDENT
  return [
    `${I}_logic_reg_anim_frame(${ctx.source}, ${animClipExpr(trig.clipName)}, function(entityId, clip, frame)`,
    `${I}${I}if frame == ${target} then`,
    `${I}${I}${I}local self = entityId`,
    `${I}${I}${I}local other = nil`,
    ...emitGuardedActions(ctx.ev, I + I + I, ctx.slugs, null, ctx.project, ctx.logicDebugTrace),
    `${I}${I}end`,
    `${I}end)`,
  ]
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
  return null
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
