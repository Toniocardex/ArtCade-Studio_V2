// ---------------------------------------------------------------------------
// Init-time callback registration — triggers that hook into the runtime's
// event dispatchers (lifecycle, input, sensor, animation, time) instead of
// polling each tick. Returns `null` for triggers handled inline by the
// per-entity tick loop (see emit-event-body.ts).
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { INDENT, luaString, poolExpr, sensorSourceExpr, isGlobalTarget } from './lua-helpers'
import {
  getKeyCombine,
  getOnInputKeyCodes,
  getOnInputRegistrationKeys,
  onInputGateExpr,
} from './on-input-keys'
import { boardLifecycleClass } from './trigger-execution'
import { emitGuardedActions } from './emit-actions'

export function emitEventRegistration(
  ev: LogicEvent,
  board: LogicBoard,
  project: ProjectDoc | null | undefined,
  slugs: Map<string, string>,
): string[] | null {
  const trig = ev.trigger
  const I = INDENT
  const pool = poolExpr(board.target)
  const source = sensorSourceExpr(board.target)
  const isGlobal = isGlobalTarget(board.target)

  if (trig.type === 'onSpawn') {
    const cls = boardLifecycleClass(board, ev, project)
    if (!cls) return null
    return [
      `${I}_logic_reg_spawn(${luaString(cls)}, function(entityId, tags)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I, slugs),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onDestroy') {
    const cls = boardLifecycleClass(board, ev, project)
    if (!cls) return null
    return [
      `${I}_logic_reg_destroy(${luaString(cls)}, function(entityId, tags)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I, slugs),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onAnimationEnd') {
    const clip =
      trig.clipName && trig.clipName.length > 0
        ? luaString(trig.clipName)
        : luaString('*')
    return [
      `${I}_logic_reg_anim_end(${source}, ${clip}, function(entityId, clip)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I, slugs),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onInput' && trig.eventType !== 'down') {
    const helper =
      trig.eventType === 'pressed' ? '_logic_reg_input_pressed' : '_logic_reg_input_released'
    const codes = getOnInputKeyCodes(trig)
    const inputGate =
      getKeyCombine(trig) === 'AND' && codes.length > 1
        ? onInputGateExpr(trig)
        : null
    const lines: string[] = []
    for (const keyCode of getOnInputRegistrationKeys(trig)) {
      if (isGlobal) {
        lines.push(
          `${I}${helper}(${luaString(keyCode)}, function()`,
          `${I}${I}local self = nil`,
          `${I}${I}local other = nil`,
          ...emitGuardedActions(ev, I + I, slugs, inputGate),
          `${I}end)`,
        )
      } else {
        lines.push(
          `${I}${helper}(${luaString(keyCode)}, function()`,
          `${I}${I}for _, self in ipairs(${pool}) do`,
          `${I}${I}${I}local other = nil`,
          ...emitGuardedActions(ev, I + I + I, slugs, inputGate),
          `${I}${I}end`,
          `${I}end)`,
        )
      }
    }
    return lines
  }

  if (trig.type === 'onTriggerEnter' || trig.type === 'onTriggerExit') {
    const helper =
      trig.type === 'onTriggerEnter' ? '_logic_reg_sensor_enter' : '_logic_reg_sensor_exit'
    const target = trig.withClass ? luaString(trig.withClass) : luaString('*')
    return [
      `${I}${helper}(${source}, ${target}, function(entityId, otherId, tag)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = otherId`,
      ...emitGuardedActions(ev, I + I, slugs),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onTimer') {
    const helper = trig.repeat ? '_logic_reg_timer_every' : '_logic_reg_timer_after'
    if (isGlobal) {
      return [
        `${I}${helper}(${Number(trig.seconds) || 0}, function()`,
        `${I}${I}local self = nil`,
        `${I}${I}local other = nil`,
        ...emitGuardedActions(ev, I + I, slugs),
        `${I}end)`,
      ]
    }
    return [
      `${I}${helper}(${Number(trig.seconds) || 0}, function()`,
      `${I}${I}for _, self in ipairs(${pool}) do`,
      `${I}${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I + I, slugs),
      `${I}${I}end`,
      `${I}end)`,
    ]
  }

  return null
}
