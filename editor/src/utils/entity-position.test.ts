import { describe, it, expect } from 'vitest'
import { normalizeEntityPosition, snapToGridValue } from './entity-position'

describe('snapToGridValue', () => {
  it('snaps to the nearest grid multiple', () => {
    expect(snapToGridValue(812.666, 32)).toBe(800)
    expect(snapToGridValue(820, 32)).toBe(832)
  })
})

describe('normalizeEntityPosition', () => {
  it('rounds to pixel integers when snap is off', () => {
    expect(normalizeEntityPosition(812.666, 425.333, false, 32)).toEqual({
      x: 813,
      y: 425,
    })
  })

  it('snaps to grid when snap is on', () => {
    expect(normalizeEntityPosition(812.666, 425.333, true, 32)).toEqual({
      x: 800,
      y: 416,
    })
  })
})
