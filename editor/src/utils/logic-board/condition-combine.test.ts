import { describe, expect, it } from 'vitest'
import { combineConditionExprs, wrapNegated } from './condition-combine'
import { conditionExpr } from './condition-expr'
import type { LogicEvent } from '../../types/logic-board'

describe('condition-combine', () => {
  it('wrapNegated inverts a leaf', () => {
    expect(wrapNegated('platformer.isGrounded(self)', true)).toBe(
      'not (platformer.isGrounded(self))',
    )
  })

  it('NOT combine uses OR inside negation for multiple parts', () => {
    expect(
      combineConditionExprs(['a', 'b'], 'NOT'),
    ).toBe('not (a or b)')
  })

  it('single check with group NOT', () => {
    const ev: LogicEvent = {
      id: 'e1',
      enabled: true,
      onlyIfEnabled: true,
      trigger: { type: 'onUpdate' },
      conditionsOperator: 'NOT',
      conditions: [{ type: 'isPlatformerGrounded', target: 'self' }],
      actions: [],
    }
    expect(conditionExpr(ev)).toContain('not (platformer.isGrounded')
  })

  it('per-row NOT with AND combine', () => {
    const ev: LogicEvent = {
      id: 'e2',
      enabled: true,
      onlyIfEnabled: true,
      trigger: { type: 'onUpdate' },
      conditions: [
        {
          type: 'isPlatformerGrounded',
          target: 'self',
          negated: true,
        },
        { type: 'compareVariable', key: 'score', operator: '>=', value: 10 },
      ],
      actions: [],
    }
    const expr = conditionExpr(ev)
    expect(expr).toMatch(/not \(platformer\.isGrounded/)
    expect(expr).toContain('global.get("score")')
    expect(expr).toContain(' and ')
  })
})
