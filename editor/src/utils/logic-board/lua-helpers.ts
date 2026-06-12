// ---------------------------------------------------------------------------
// Lua code-generation helpers — pure serialisation utilities shared across
// compiler modules. No imports from the rest of the logic-board package.
// ---------------------------------------------------------------------------

import type { LogicBoard, TargetSelector } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import {
  logicBoardRuntimeClassKey,
  logicBoardTargetEntityIds,
  logicBoardTargetTypeKey,
} from '../project-queries'

function compilePoolBoard(target: LogicBoard['target']): LogicBoard {
  return { boardId: '_pool', target, events: [] }
}

/** Two-space indent unit used by every emitter in the compiler pipeline. */
export const INDENT = '  '

/** Strip ASCII control characters unsafe in Lua string literals. */
/** Remove NUL and other controls; keep tab/LF/CR (escaped by luaString). */
function sanitizeLuaStringInput(s: string): string {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
}

/** Escape a JS string into a safe double-quoted Lua string literal. */
export function luaString(s: string): string {
  const clean = sanitizeLuaStringInput(s)
  return (
    '"' +
    clean
      .replace(/\\/g, String.raw`\\`)
      .replace(/"/g, String.raw`\"`)
      .replace(/\n/g, String.raw`\n`)
      .replace(/\r/g, String.raw`\r`)
      .replace(/\t/g, String.raw`\t`) +
    '"'
  )
}

/** Render a JS value (string/number/boolean) as a Lua literal. */
export function luaValue(v: number | string | boolean): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return luaString(v)
}

/**
 * Resolve a TargetSelector to a Lua expression yielding an entity id.
 * `self` / `other` are loop-local locals emitted by the trigger scaffolding.
 */
/** First entity id for a class/object-type slug (legacy Entity_* aware). */
export function targetClassFirstExpr(
  className: string,
  project?: ProjectDoc | null,
): string {
  if (!project) {
    return `(pool.getAll(${luaString(className)})[1])`
  }
  const board = compilePoolBoard({
    type: 'object_type',
    objectTypeId: className,
  })
  const ids = logicBoardTargetEntityIds(project, board)
  if (ids.length === 1) return String(ids[0])
  const runtimeKey = logicBoardRuntimeClassKey(project, board)
  if (runtimeKey) {
    return `(pool.getAll(${luaString(runtimeKey)})[1])`
  }
  const poolKey = logicBoardTargetTypeKey(board.target)
  if (poolKey) {
    return `(pool.getAll(${luaString(poolKey)})[1])`
  }
  return `(pool.getAll(${luaString(className)})[1])`
}

export function targetExpr(
  t: TargetSelector,
  project?: ProjectDoc | null,
): string {
  if (t === 'self') return 'self'
  if (t === 'other') return 'other'
  if ('entityId' in t) return String(t.entityId)
  return targetClassFirstExpr(t.className, project)
}

/**
 * True when the board has no entity context (`self` is nil). Global boards
 * skip the per-entity for-loop scaffolding emitted around init/tick blocks.
 */
export function isGlobalTarget(target: { type: string }): boolean {
  return target.type === 'global' || target.type === 'scene'
}

/** Lua expression that yields the entity-id pool for a board's target. */
export function poolExpr(
  target: LogicBoard['target'],
  project?: ProjectDoc | null,
): string {
  if (project) {
    const board = compilePoolBoard(target)
    const ids = logicBoardTargetEntityIds(project, board)
    if (ids.length === 1) return `{ ${ids[0]} }`
    if (ids.length > 1) return `{ ${ids.join(', ')} }`
    const runtimeKey = logicBoardRuntimeClassKey(project, board)
    if (runtimeKey) return `pool.getAll(${luaString(runtimeKey)})`
  }
  const poolKey = logicBoardTargetTypeKey(target)
  if (poolKey) {
    return `pool.getAll(${luaString(poolKey)})`
  }
  return `{}`
}

/** Lua expression identifying the sensor source for a board's target. */
export function sensorSourceExpr(target: {
  type: string
  objectTypeId?: string
}): string {
  const key = logicBoardTargetTypeKey(target as LogicBoard['target'])
  if (key) return luaString(key)
  return luaString('*')
}

/**
 * Lua statement assigning world pointer coords: `local _mx,_my=input.mouseWorld()`.
 * Use for spawn-at-pointer and any action needing world-space mouse position.
 */
export function luaPointerWorldPairStmt(): string {
  return 'local _mx,_my=input.mouseWorld()'
}

/**
 * Lua expression: true when the pointer (world space) is within `radius` px
 * of this entity's position. Uses input.mouseWorld() + entity.position(self).
 */
export function luaPointerNearSelfExpr(radius: number): string {
  const r = Math.max(0, radius)
  const r2 = r * r
  return `(function() local mx,my=input.mouseWorld() local px,py=entity.position(self) local dx=mx-px local dy=my-py return (dx*dx+dy*dy) <= ${r2} end)()`
}
