import { describe, expect, it } from 'vitest'
import {
  conditionTypesForTrigger,
  conditionTypesInUse,
  recommendedConditionTypes,
} from './condition-picker'

describe('condition-picker', () => {
  it('hides isKeyDown when trigger is onInput in base mode', () => {
    const types = conditionTypesForTrigger(
      { type: 'onInput', keyCode: 'KeyW', eventType: 'pressed' },
      undefined,
      'base',
    )
    expect(types).not.toContain('isKeyDown')
    expect(types).toContain('compareVariable')
  })

  it('keeps isKeyDown for onInput in advanced mode', () => {
    const types = conditionTypesForTrigger(
      { type: 'onInput', keyCode: 'KeyW', eventType: 'pressed' },
      undefined,
      'advanced',
    )
    expect(types).toContain('isKeyDown')
  })

  it('keeps isKeyDown for onUpdate', () => {
    const types = conditionTypesForTrigger({ type: 'onUpdate' })
    expect(types).toContain('isKeyDown')
  })

  it('preserves isKeyDown in picker when already on the event (base + onInput)', () => {
    const types = conditionTypesForTrigger(
      { type: 'onInput', keyCode: 'KeyW', eventType: 'pressed' },
      undefined,
      'base',
      ['isKeyDown'],
    )
    expect(types).toContain('isKeyDown')
  })

  it('conditionTypesInUse collects flat and tree leaves', () => {
    expect(
      conditionTypesInUse({
        id: 'e',
        enabled: true,
        trigger: { type: 'onUpdate' },
        conditions: [{ type: 'compareVariable', key: 'x', operator: '==', value: 0 }],
        actions: [],
      }),
    ).toEqual(['compareVariable'])
  })

  it('never recommends isKeyDown for onInput', () => {
    expect(
      recommendedConditionTypes(
        { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
        null,
        null,
      ),
    ).not.toContain('isKeyDown')
  })
})
