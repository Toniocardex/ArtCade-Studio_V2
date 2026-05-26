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
import { combineConditionExprs, wrapNegated } from './condition-combine'
import { luaString, luaValue, targetExpr } from './lua-helpers'

/**
 * Whitelist of binary comparison operators that may appear in a condition.
 * TypeScript already constrains the field, but we revalidate at emit time so
 * a corrupted/hand-edited project.json cannot inject arbitrary Lua via the
 * `c.operator` interpolation in compareVariable/compareDistance/compareHealth.
 * Unknown operators degrade to `==`, which is the safest neutral comparator.
 */
const COMPARISON_OPS = new Set(['==', '~=', '<', '<=', '>', '>='])
function safeOp(op: string): string {
  return COMPARISON_OPS.has(op) ? op : '=='
}

function leafExpr(c: LogicCondition): string {
  switch (c.type) {
    case 'compareClass':
      return `collision.touchingClass(self, ${luaString(c.className)})`
    case 'compareVariable':
      return `(state.get(${luaString(c.key)}) ${safeOp(c.operator)} ${luaValue(c.value)})`
    case 'isKeyDown':
      return `input.isKeyDown(${luaString(c.keyCode)})`
    case 'hasTag':
      return `(function() for _,e in ipairs(object.findByTag(${luaString(c.tag)})) do if e==self then return true end end return false end)()`
    case 'compareDistance':
      return `(object.distance(self, ${targetExpr(c.target)}) ${safeOp(c.operator)} ${Number(c.value) || 0})`
    case 'isMouseOver': {
      const r2 = Math.pow(Number(c.radius) || 32, 2)
      return `(function() local mx,my=input.mousePosition() local p=entity.position(self) local dx=mx-p.x local dy=my-p.y return (dx*dx+dy*dy) <= ${r2} end)()`
    }
    case 'raycastHit': {
      const dx = Number(c.dirX) || 0
      const dy = Number(c.dirY) || 0
      const len = Number(c.length) || 0
      const classChk = c.className
        ? ` local ok=false for _,e in ipairs(pool.getAll(${luaString(c.className)})) do if e==r.entityId then ok=true break end end if not ok then return false end`
        : ''
      return `(function() local p=entity.position(self) local r=collision.raycast(p.x,p.y,p.x+(${dx})*(${len}),p.y+(${dy})*(${len})) if not r.hit then return false end${classChk} return true end)()`
    }
    case 'chance':
      return `(math.random(100) <= ${Number(c.percent) || 0})`
    case 'isSpaceFree':
      return `grid.isSpaceFree(${Number(c.x) || 0}, ${Number(c.y) || 0}, ${Number(c.w) || 32}, ${Number(c.h) || 32})`
    case 'compareHealth': {
      const target = targetExpr(c.target)
      const value = Number(c.value) || 0
      const field = c.field === 'max' ? '_m' : '_c'
      return `(function() local _c,_m=entity.health(${target}); if _c == nil then return false end return (${field} ${safeOp(c.operator)} ${value}) end)()`
    }
    case 'isPlatformerGrounded':
      return `platformer.isGrounded(${targetExpr(c.target)})`
  }
}

function nodeExpr(n: LogicConditionNode): string {
  if (n.kind === 'leaf') {
    return wrapNegated(leafExpr(n.condition), n.negated)
  }
  const parts = n.statements.map(nodeExpr)
  if (n.operator === 'NOT') return combineConditionExprs(parts, 'NOT')
  return combineConditionExprs(parts, n.operator)
}

/** Build the boolean guard for an event (flat list = AND; root = tree). */
export function conditionExpr(ev: LogicEvent): string {
  if (ev.onlyIfEnabled === false) return 'true'
  if (ev.conditionRoot) return nodeExpr(ev.conditionRoot)
  const list = ev.conditions ?? []
  if (list.length === 0) return 'true'
  const op = ev.conditionsOperator ?? 'AND'
  const parts = list.map((c) => wrapNegated(leafExpr(c), c.negated))
  return combineConditionExprs(parts, op)
}
