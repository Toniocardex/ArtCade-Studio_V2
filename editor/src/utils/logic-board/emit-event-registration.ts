// ---------------------------------------------------------------------------
// Init-time callback registration — triggers that hook into the runtime's
// event dispatchers (lifecycle, input, sensor, animation, time) instead of
// polling each tick. Returns `null` for triggers handled inline by the
// per-entity tick loop (see emit-event-body.ts).
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { INDENT, luaString, poolExpr, sensorSourceExpr } from './lua-helpers'
import { boardLifecycleClass } from './trigger-execution'
import { emitGuardedActions } from './emit-actions'

export function emitEventRegistration(
  ev: LogicEvent,
  board: LogicBoard,
  project?: ProjectDoc | null,
  slugs?: Map<string, string>,
): string[] | null {
  const trig = ev.trigger
  const I = INDENT
  const pool = poolExpr(board.target)
  const source = sensorSourceExpr(board.target)

  if (trig.type === 'onSpawn') {
    const cls = boardLifecycleClass(board, ev, project)
    if (!cls) return null
    return [
      `${I}lifecycle.onSpawn(${luaString(cls)}, function(entityId, tags)`,
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
      `${I}lifecycle.onDestroy(${luaString(cls)}, function(entityId, tags)`,
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
      `${I}animation.onFinished(${source}, ${clip}, function(entityId, clip)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I, slugs),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onInput' && trig.eventType !== 'down') {
    const hook = trig.eventType === 'pressed' ? 'onPressed' : 'onReleased'
    return [
      `${I}input.${hook}(${luaString(trig.keyCode)}, function()`,
      `${I}${I}for _, self in ipairs(${pool}) do`,
      `${I}${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I + I, slugs),
      `${I}${I}end`,
      `${I}end)`,
    ]
  }

  if (trig.type === 'onTriggerEnter' || trig.type === 'onTriggerExit') {
    const hook = trig.type === 'onTriggerEnter' ? 'onEnter' : 'onExit'
    const target = trig.withClass ? luaString(trig.withClass) : luaString('*')
    return [
      `${I}sensor.${hook}(${source}, ${target}, function(entityId, otherId, tag)`,
      `${I}${I}local self = entityId`,
      `${I}${I}local other = otherId`,
      ...emitGuardedActions(ev, I + I, slugs),
      `${I}end)`,
    ]
  }

  if (trig.type === 'onTimer') {
    const fn = trig.repeat ? 'every' : 'after'
    return [
      `${I}time.${fn}(${Number(trig.seconds) || 0}, function()`,
      `${I}${I}for _, self in ipairs(${pool}) do`,
      `${I}${I}${I}local other = nil`,
      ...emitGuardedActions(ev, I + I + I, slugs),
      `${I}${I}end`,
      `${I}end)`,
    ]
  }

  return null
}
