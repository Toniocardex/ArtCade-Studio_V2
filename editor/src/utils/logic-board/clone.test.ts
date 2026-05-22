import { describe, expect, it } from 'vitest'
import { createLogicEvent } from './factory'
import { cloneLogicAction, cloneLogicEvent } from './clone'

describe('cloneLogicEvent', () => {
  it('copies payload and assigns a new id', () => {
    const src = createLogicEvent(
      { type: 'onInput', keyCode: 'KeyD', eventType: 'pressed' },
      [{ type: 'moveController', target: 'self', direction: 'right' }],
    )
    src.enabled = false
    src.conditions = [{ type: 'isKeyDown', keyCode: 'KeyD' }]

    const copy = cloneLogicEvent(src)
    expect(copy.id).not.toBe(src.id)
    expect(copy.enabled).toBe(false)
    expect(copy.trigger).toEqual(src.trigger)
    expect(copy.conditions).toEqual(src.conditions)
    expect(copy.actions).toEqual(src.actions)
  })
})

describe('cloneLogicAction', () => {
  it('deep-copies action fields', () => {
    const src = { type: 'setVelocity' as const, target: 'self' as const, vx: 10, vy: -5 }
    const copy = cloneLogicAction(src)
    expect(copy).toEqual(src)
    expect(copy).not.toBe(src)
  })
})
