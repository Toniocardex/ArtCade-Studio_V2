import type {
  LogicExpression,
  LogicPrimitive,
  LogicValue,
  LogicValueAtom,
  LogicValueSource,
} from '../../types/logic-board'
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

function componentValueExpr(
  source: Extract<LogicValueSource, { source: 'component' }>,
  project?: ProjectDoc | null,
): string {
  const target = targetExpr(source.target, project)
  const fallback = fallbackExpr(source.fallback, 0)
  return `(function() local _target=${target}; if _target==nil then return ${fallback} end; local _value=component.value(_target, ${luaString(source.property)}); if _value==nil then return ${fallback} end; return _value end)()`
}

function atomExpr(value: LogicValueAtom, project?: ProjectDoc | null): string {
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
    case 'component':
      return componentValueExpr(value, project)
    case 'random':
      return `_logic_random_int(${Number(value.min) || 0}, ${Number(value.max) || 0})`
  }
}

function numericAtomExpr(value: LogicValueAtom, project?: ProjectDoc | null): string {
  return `(tonumber(${atomExpr(value, project)}) or 0)`
}

function expressionExpr(expression: LogicExpression, project?: ProjectDoc | null): string {
  let result = numericAtomExpr(expression.initial, project)
  for (const operation of expression.operations) {
    const right = numericAtomExpr(operation.value, project)
    switch (operation.operator) {
      case 'add':
        result = `(${result} + ${right})`
        break
      case 'subtract':
        result = `(${result} - ${right})`
        break
      case 'multiply':
        result = `(${result} * ${right})`
        break
      case 'divide':
        result = `(function() local _left=${result}; local _right=${right}; if _right==0 then return 0 end; return _left/_right end)()`
        break
      case 'modulo':
        result = `(function() local _left=${result}; local _right=${right}; if _right==0 then return 0 end; return _left%_right end)()`
        break
      case 'min':
        result = `math.min(${result}, ${right})`
        break
      case 'max':
        result = `math.max(${result}, ${right})`
        break
      case 'power':
        result = `(${result} ^ ${right})`
        break
    }
  }
  return result
}

/** Compile a literal or typed Value Source into a side-effect-safe Lua expression. */
export function valueSourceExpr(value: LogicValue, project?: ProjectDoc | null): string {
  if (typeof value === 'object' && value !== null && value.source === 'expression') {
    return expressionExpr(value, project)
  }
  return atomExpr(value as LogicValueAtom, project)
}

/** Compile a Value Source and coerce its result to a finite numeric fallback. */
export function numberSourceExpr(
  value: LogicValue,
  project?: ProjectDoc | null,
  fallback = 0,
): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : String(fallback)
  return `(function() local _number=tonumber(${valueSourceExpr(value, project)}); if _number==nil or _number~=_number or _number==math.huge or _number==-math.huge then return ${fallback} end; return _number end)()`
}
