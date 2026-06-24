import { describe, expect, it } from 'vitest'
import {
  fillColorToHex,
  hasSpriteImageAsset,
  hexToFillColor,
  DEFAULT_FILL_COLOR,
} from './sprite-fill-color'

describe('sprite-fill-color', () => {
  it('hasSpriteImageAsset is false for empty path', () => {
    expect(hasSpriteImageAsset('')).toBe(false)
    expect(hasSpriteImageAsset('  ')).toBe(false)
    expect(hasSpriteImageAsset('assets/a.png')).toBe(true)
  })

  it('fillColorToHex encodes RGB', () => {
    expect(fillColorToHex({ x: 1, y: 0, z: 0 })).toBe('#ff0000')
    expect(fillColorToHex(DEFAULT_FILL_COLOR)).toBe('#ffffff')
  })

  it('hexToFillColor parses with and without leading hash, any case', () => {
    expect(hexToFillColor('#ff0000')).toEqual({ x: 1, y: 0, z: 0 })
    expect(hexToFillColor('00FF00')).toEqual({ x: 0, y: 1, z: 0 })
    expect(hexToFillColor('  #0000ff  ')).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('hexToFillColor returns null for malformed input', () => {
    expect(hexToFillColor('')).toBeNull()
    expect(hexToFillColor('#fff')).toBeNull()
    expect(hexToFillColor('#gggggg')).toBeNull()
    expect(hexToFillColor('red')).toBeNull()
  })

  it('round-trips through fillColorToHex', () => {
    const fill = hexToFillColor('#3c8a64')
    expect(fill).not.toBeNull()
    expect(fillColorToHex(fill!)).toBe('#3c8a64')
  })
})
