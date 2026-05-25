// ---------------------------------------------------------------------------
// Lua code-generation helpers — pure serialisation utilities shared across
// compiler modules. No imports from the rest of the logic-board package.
// ---------------------------------------------------------------------------

import type { TargetSelector } from '../../types/logic-board'

/** Two-space indent unit used by every emitter in the compiler pipeline. */
export const INDENT = '  '

/** Escape a JS string into a safe double-quoted Lua string literal. */
export function luaString(s: string): string {
  return (
    '"' +
    s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
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
export function targetExpr(t: TargetSelector): string {
  if (t === 'self') return 'self'
  if (t === 'other') return 'other'
  if ('entityId' in t) return String(t.entityId)
  // class pool — MVP resolves to the first match (Lua arrays are 1-indexed)
  return `(pool.getAll(${luaString(t.className)})[1])`
}

/** Lua expression that yields the entity-id pool for a board's target. */
export function poolExpr(target: { type: string; className?: string; entityId?: number }): string {
  if (target.type === 'entity_class' && target.className) {
    return `pool.getAll(${luaString(target.className)})`
  }
  if (target.type === 'entity_id' && target.entityId != null) {
    return `{ ${target.entityId} }`
  }
  return `{}`
}

/** Lua expression identifying the sensor source for a board's target. */
export function sensorSourceExpr(target: { type: string; className?: string; entityId?: number }): string {
  if (target.type === 'entity_class' && target.className)
    return luaString(target.className)
  if (target.type === 'entity_id' && target.entityId != null)
    return String(target.entityId)
  return luaString('*')
}
