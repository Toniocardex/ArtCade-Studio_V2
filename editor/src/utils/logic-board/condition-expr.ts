// ---------------------------------------------------------------------------
// Condition expressions — turn a LogicCondition / LogicConditionNode tree
// into a single Lua boolean expression usable inside an `if ... then` guard.
//
// Public entry: `conditionExpr(ev)` returns `"true"` when the event is
// unconditional. Leaf and node builders are kept private to this file so the
// compiler call sites only see the resolved expression.
// ---------------------------------------------------------------------------

import type {
  LogicCondition,
  LogicConditionNode,
  LogicEvent,
} from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { combineConditionExprs, wrapNegated } from './condition-combine'
import { luaPointerNearSelfExpr, luaString, targetExpr } from './lua-helpers'
import { numberSourceExpr, valueSourceExpr } from './value-source'

/**
 * Whitelist of binary comparison operators that may appear in a condition.
 * TypeScript already constrains the field, but we revalidate at emit time so
 * a corrupted/hand-edited project.json cannot inject arbitrary Lua via the
 * `c.operator` interpolation in compareVariable/compareDistance/compareHealth.
 * Unknown operators degrade to `==`, which is the safest neutral comparator.
 */
const COMPARISON_OPS = new Set(['==', '~=', '<', '<=', '>', '>='])
function safeOp(op: string): string {
  if (op === '!=') return '~='
  return COMPARISON_OPS.has(op) ? op : '=='
}

function comparisonExpr(left: string, operator: string, right: string): string {
  const op = safeOp(operator)
  if (op === '==' || op === '~=') return `(${left} ${op} ${right})`
  return `(function() local _left=${left}; local _right=${right}; local _leftNumber=tonumber(_left); local _rightNumber=tonumber(_right); if _leftNumber~=nil and _rightNumber~=nil then return (_leftNumber ${op} _rightNumber) end; if type(_left)~="string" or type(_right)~="string" then return false end; return (_left ${op} _right) end)()`
}

function leafExpr(c: LogicCondition, project?: ProjectDoc | null): string {
  switch (c.type) {
    case 'compareClass':
      return `collision.touchingClass(self, ${luaString(c.className)})`
    case 'compareVariable':
      return comparisonExpr(
        `global.get(${luaString(c.key)})`,
        c.operator,
        valueSourceExpr(c.value, project),
      )
    case 'compareValues':
      return comparisonExpr(
        valueSourceExpr(c.left, project),
        c.operator,
        valueSourceExpr(c.right, project),
      )
    case 'isKeyDown':
      return `input.isKeyDown(${luaString(c.keyCode)})`
    case 'hasTag':
      return `(function() for _,e in ipairs(object.findByTag(${luaString(c.tag)})) do if e==self then return true end end return false end)()`
    case 'compareDistance':
      return `(object.distance(self, ${targetExpr(c.target, project)}) ${safeOp(c.operator)} ${Number(c.value) || 0})`
    case 'isMouseOver':
      return luaPointerNearSelfExpr(Number(c.radius) || 32)
    case 'raycastHit': {
      const dx = Number(c.dirX) || 0
      const dy = Number(c.dirY) || 0
      const len = Number(c.length) || 0
      const classChk = c.className
        ? ` local ok=false for _,e in ipairs(pool.getAll(${luaString(c.className)})) do if e==r.entityId then ok=true break end end if not ok then return false end`
        : ''
      return `(function() local _px,_py=entity.position(self) local r=collision.raycast(_px,_py,_px+(${dx})*(${len}),_py+(${dy})*(${len})) if not r.hit then return false end${classChk} return true end)()`
    }
    case 'chance':
      return `_logic_random_chance(${numberSourceExpr(c.percent, project)})`
    case 'isTileAreaFree':
    case 'isSpaceFree':
      return `grid.isSpaceFree(${numberSourceExpr(c.x, project)}, ${numberSourceExpr(c.y, project)}, ${numberSourceExpr(c.w, project, 32)}, ${numberSourceExpr(c.h, project, 32)})`
    case 'compareHealth': {
      const target = targetExpr(c.target, project)
      const value = numberSourceExpr(c.value, project)
      const field = c.field === 'max' ? '_m' : '_c'
      return `(function() local _c,_m=entity.health(${target}); if _c == nil then return false end return (${field} ${safeOp(c.operator)} ${value}) end)()`
    }
    case 'isPlatformerGrounded':
      return `platformer.isGrounded(${targetExpr(c.target, project)})`
    case 'compareCount':
      return `(pool.count(${luaString(c.className)}) ${safeOp(c.operator)} ${numberSourceExpr(c.value, project)})`
    case 'entityExists':
      return `object.exists(${targetExpr(c.target, project)})`
    case 'compareVelocity': {
      const t = targetExpr(c.target, project)
      const val = numberSourceExpr(c.value, project)
      const op = safeOp(c.operator)
      if (c.axis === 'magnitude')
        return `(function() local _vx,_vy=entity.velocity(${t}); return (math.sqrt(_vx*_vx+_vy*_vy) ${op} ${val}) end)()`
      const component = c.axis === 'y' ? '_vy' : '_vx'
      return `(function() local _vx,_vy=entity.velocity(${t}); return (${component} ${op} ${val}) end)()`
    }
    case 'comparePosition': {
      const t = targetExpr(c.target, project)
      const val = numberSourceExpr(c.value, project)
      const op = safeOp(c.operator)
      const component = c.axis === 'y' ? '_py' : '_px'
      return `(function() local _px,_py=entity.position(${t}); return (${component} ${op} ${val}) end)()`
    }
    case 'saveExists':
      return `save.exists(${luaString(c.slot || 'main')})`
    case 'isDialogActive':
      return `dialog.isActive()`
    case 'isMusicPlaying':
      return `audio.isMusicPlaying()`
    case 'isPaused':
      return `time.isPaused()`
    case 'isOffScreen':
      return `screen.isOffScreen(${targetExpr(c.target, project)})`
  }
}

function nodeExpr(n: LogicConditionNode, project?: ProjectDoc | null): string {
  if (n.kind === 'leaf') {
    return wrapNegated(leafExpr(n.condition, project), n.negated)
  }
  const parts = n.statements.map((s) => nodeExpr(s, project))
  if (n.operator === 'NOT') return combineConditionExprs(parts, 'NOT')
  return combineConditionExprs(parts, n.operator)
}

/** Build the boolean guard for an event (flat list = AND; root = tree). */
export function conditionExpr(ev: LogicEvent, project?: ProjectDoc | null): string {
  if (ev.onlyIfEnabled === false) return 'true'
  if (ev.conditionRoot) return nodeExpr(ev.conditionRoot, project)
  const list = ev.conditions ?? []
  if (list.length === 0) return 'true'
  const op = ev.conditionsOperator ?? 'AND'
  const parts = list.map((c) => wrapNegated(leafExpr(c, project), c.negated))
  return combineConditionExprs(parts, op)
}
