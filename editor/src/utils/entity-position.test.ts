import { describe, it, expect } from 'vitest'
import { clampEntityPositionToScene, normalizeEntityPosition, snapToGridValue } from './entity-position'

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

describe('clampEntityPositionToScene', () => {
  it('keeps an entity inset from the bottom-right scene edge', () => {
    expect(clampEntityPositionToScene({ x: 640, y: 320 }, { x: 640, y: 320 }))
      .toEqual({ x: 608, y: 288 })
  })

  it('centres the entity when the scene is smaller than the inset', () => {
    expect(clampEntityPositionToScene({ x: 100, y: 100 }, { x: 32, y: 32 }))
      .toEqual({ x: 16, y: 16 })
  })
})
