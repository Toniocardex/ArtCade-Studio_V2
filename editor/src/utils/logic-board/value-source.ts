import type { LogicPrimitive, LogicValue, LogicValueSource } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { luaString, luaValue, targetExpr } from './lua-helpers'

function fallbackExpr(value: LogicPrimitive | undefined, fallback: LogicPrimitive): string {
  return luaValue(value ?? fallback)
}

function entityValueExpr(
  source: Extract<LogicValueSource, { source: 'entity' }>,
  project?: ProjectDoc | null,
): string {
  const target = targetExpr(source.target, project)
  const prefix = `local _target=${target}; if _target==nil then return 0 end; `
  switch (source.property) {
    case 'positionX':
      return `(function() ${prefix}local _x,_y=entity.position(_target); return _x end)()`
    case 'positionY':
      return `(function() ${prefix}local _x,_y=entity.position(_target); return _y end)()`
    case 'velocityX':
      return `(function() ${prefix}local _x,_y=entity.velocity(_target); return _x end)()`
    case 'velocityY':
      return `(function() ${prefix}local _x,_y=entity.velocity(_target); return _y end)()`
    case 'speed':
      return `(function() ${prefix}local _x,_y=entity.velocity(_target); return math.sqrt(_x*_x+_y*_y) end)()`
    case 'healthCurrent':
      return `(function() ${prefix}local _current,_max=entity.health(_target); return _current or 0 end)()`
    case 'healthMax':
      return `(function() ${prefix}local _current,_max=entity.health(_target); return _max or 0 end)()`
  }
  return '0'
}

/** Compile a literal or typed Value Source into a side-effect-safe Lua expression. */
export function valueSourceExpr(value: LogicValue, project?: ProjectDoc | null): string {
  if (typeof value !== 'object' || value === null) return luaValue(value)
  switch (value.source) {
    case 'state': {
      const fallback = fallbackExpr(value.fallback, 0)
      return `(function() local _value=state.get(${luaString(value.key)}); if _value==nil then return ${fallback} end; return _value end)()`
    }
    case 'message': {
      const fallback = fallbackExpr(value.fallback, 0)
      const key = luaString(value.key)
      return `(function() if type(_message)~="table" then return ${fallback} end; local _value=_message[${key}]; if _value==nil then return ${fallback} end; return _value end)()`
    }
    case 'entity':
      return entityValueExpr(value, project)
    case 'random':
      return `_logic_random_int(${Number(value.min) || 0}, ${Number(value.max) || 0})`
  }
  return '0'
}

/** Compile a Value Source and coerce its result to a finite numeric fallback. */
export function numberSourceExpr(
  value: LogicValue,
  project?: ProjectDoc | null,
  fallback = 0,
): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : String(fallback)
  return `(tonumber(${valueSourceExpr(value, project)}) or ${fallback})`
}
