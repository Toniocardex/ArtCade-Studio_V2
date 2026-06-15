import { describe, it, expect } from 'vitest'
import { emitActionSequence } from './emit-action-sequence'
import type { LogicAction } from '../../types/logic-board'

const slugs = new Map<string, string>()
const emit = (a: LogicAction) => emitActionSequence([a], '', slugs)[0]

describe('modifyVariable emitter', () => {
  it('global add', () => {
    expect(emit({ type: 'modifyVariable', scope: 'global', op: 'add', key: 'score', value: 10 }))
      .toBe('global.add("score", 10)')
  })

  it('global subtract emits a negated add', () => {
    expect(emit({ type: 'modifyVariable', scope: 'global', op: 'subtract', key: 'score', value: 10 }))
      .toBe('global.add("score", -(10))')
  })

  it('object subtract (HP damage) targets the entity var', () => {
    expect(emit({ type: 'modifyVariable', scope: 'object', op: 'subtract', key: 'hp', value: 10, target: 'self' }))
      .toBe('objectvar.add(self, "hp", -(10))')
  })

  it('global multiply reads then writes', () => {
    expect(emit({ type: 'modifyVariable', scope: 'global', op: 'multiply', key: 'score', value: 2 }))
      .toBe('global.set("score", (global.get("score") or 0) * (2))')
  })

  it('object divide reads then writes', () => {
    expect(emit({ type: 'modifyVariable', scope: 'object', op: 'divide', key: 'hp', value: 2, target: 'self' }))
      .toBe('objectvar.set(self, "hp", (objectvar.get(self, "hp") or 0) / (2))')
  })

  it('global set assigns directly', () => {
    expect(emit({ type: 'modifyVariable', scope: 'global', op: 'set', key: 'score', value: 0 }))
      .toBe('global.set("score", 0)')
  })

  it('subtract accepts a variable value source (expression), coerced to a number', () => {
    const lua = emit({
      type: 'modifyVariable', scope: 'object', op: 'subtract', key: 'hp', target: 'self',
      value: { source: 'global', key: 'damage' },
    })
    expect(lua).toMatch(/^objectvar\.add\(self, "hp", -\(/)
    expect(lua).toContain('global.get("damage")')
    expect(lua).toContain('tonumber')
  })
})
