import { describe, expect, it } from 'vitest'
import { numberSourceExpr, valueSourceExpr } from './value-source'

describe('Value Source expressions', () => {
  it('combines entity and component values from left to right', () => {
    const lua = valueSourceExpr({
      source: 'expression',
      initial: { source: 'entity', target: 'self', property: 'healthCurrent' },
      operations: [
        {
          operator: 'divide',
          value: { source: 'entity', target: 'self', property: 'healthMax' },
        },
        { operator: 'multiply', value: 100 },
      ],
    })

    expect(lua).toContain('entity.health(_target)')
    expect(lua).toContain('if _right==0 then return 0 end')
    expect(lua).toContain('* (tonumber(100) or 0)')
  })

  it('reads Component properties with an explicit fallback', () => {
    const lua = valueSourceExpr({
      source: 'component',
      target: 'self',
      property: 'magnet.pullSpeed',
      fallback: 25,
    })

    expect(lua).toContain('component.value(_target, "magnet.pullSpeed")')
    expect(lua).toContain('if _value==nil then return 25 end')
  })

  it('guards divide and modulo by zero deterministically', () => {
    for (const operator of ['divide', 'modulo'] as const) {
      const lua = numberSourceExpr({
        source: 'expression',
        initial: 10,
        operations: [{ operator, value: 0 }],
      })
      expect(lua).toContain('if _right==0 then return 0 end')
      expect(lua).not.toContain('math.random')
    }
  })

  it('falls back to 0 for malformed value sources', () => {
    const malformed = { source: 'legacyState' } as Parameters<typeof valueSourceExpr>[0]
    expect(valueSourceExpr(malformed)).toBe('0')
    expect(numberSourceExpr(malformed)).toContain('tonumber(0)')
  })

  it('rejects non-finite numeric results at action boundaries', () => {
    const lua = numberSourceExpr({
      source: 'expression',
      initial: 10,
      operations: [{ operator: 'power', value: 1000 }],
    }, null, 7)

    expect(lua).toContain('_number==math.huge')
    expect(lua).toContain('_number==-math.huge')
    expect(lua).toContain('then return 7')
  })
})
