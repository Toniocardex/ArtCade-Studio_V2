// ---------------------------------------------------------------------------
// Init-time callback registration — triggers that hook into the runtime's
// event dispatchers (lifecycle, input, sensor, animation, time) instead of
// polling each tick. Returns `null` for triggers handled inline by the
// per-entity tick loop (see emit-event-body.ts).
// ---------------------------------------------------------------------------

import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { poolExpr, sensorSourceExpr, isGlobalTarget } from './lua-helpers'
import {
  emitAnimationEndRegistration,
  emitDestroyRegistration,
  emitOnInputRegistration,
  emitSensorRegistration,
  emitSpawnRegistration,
  emitTimerRegistration,
} from './emit-registration-handlers'

export function emitEventRegistration(
  ev: LogicEvent,
  board: LogicBoard,
  project: ProjectDoc | null | undefined,
  slugs: Map<string, string>,
): string[] | null {
  const ctx = {
    ev,
    board,
    project,
    slugs,
    pool: poolExpr(board.target, project),
    source: sensorSourceExpr(board.target),
    isGlobal: isGlobalTarget(board.target),
  }

  return (
    emitSpawnRegistration(ctx)
    ?? emitDestroyRegistration(ctx)
    ?? emitAnimationEndRegistration(ctx)
    ?? emitOnInputRegistration(ctx)
    ?? emitSensorRegistration(ctx)
    ?? emitTimerRegistration(ctx)
  )
}
