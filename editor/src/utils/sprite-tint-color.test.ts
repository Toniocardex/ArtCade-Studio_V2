import { describe, expect, it } from 'vitest'
import {
  hasSpriteImageAsset,
  isDefaultSpriteTint,
  parseHexColor,
  spriteTintFromHex,
  spriteTintToHex,
} from './sprite-tint-color'

describe('spriteTintToHex', () => {
  it('converts vec4 rgb to #rrggbb', () => {
    expect(spriteTintToHex({ x: 1, y: 0, z: 0, w: 1 })).toBe('#ff0000')
    expect(spriteTintToHex({ x: 0, y: 1, z: 0, w: 0.5 })).toBe('#00ff00')
  })
})

describe('spriteTintFromHex', () => {
  it('updates rgb and preserves w', () => {
    const next = spriteTintFromHex({ x: 1, y: 1, z: 1, w: 0.25 }, '#336699')
    expect(next).toEqual({
      x: expect.closeTo(0.2, 2),
      y: expect.closeTo(0.4, 2),
      z: expect.closeTo(0.6, 2),
      w: 0.25,
    })
  })

  it('accepts shorthand hex', () => {
    const next = spriteTintFromHex({ x: 0, y: 0, z: 0, w: 1 }, '#f00')
    expect(next?.x).toBeCloseTo(1, 2)
    expect(next?.y).toBeCloseTo(0, 2)
    expect(next?.z).toBeCloseTo(0, 2)
  })

  it('returns null for invalid hex', () => {
    expect(spriteTintFromHex({ x: 1, y: 1, z: 1, w: 1 }, 'not-a-color')).toBeNull()
  })
})

describe('parseHexColor', () => {
  it('parses with or without hash', () => {
    expect(parseHexColor('#aabbcc')).toEqual({
      r: expect.closeTo(170 / 255, 3),
      g: expect.closeTo(187 / 255, 3),
      b: expect.closeTo(204 / 255, 3),
    })
  })
})

describe('hasSpriteImageAsset', () => {
  it('is false when asset id is empty', () => {
    expect(hasSpriteImageAsset('')).toBe(false)
    expect(hasSpriteImageAsset('   ')).toBe(false)
  })

  it('is true when a path is set', () => {
    expect(hasSpriteImageAsset('assets/images/hero.png')).toBe(true)
  })
})

describe('isDefaultSpriteTint', () => {
  it('detects white tint', () => {
    expect(isDefaultSpriteTint({ x: 1, y: 1, z: 1, w: 1 })).toBe(true)
    expect(isDefaultSpriteTint({ x: 0.5, y: 1, z: 1, w: 1 })).toBe(false)
  })
})
