import { describe, expect, it } from 'vitest'
import { fillColorToHex, hasSpriteImageAsset, DEFAULT_FILL_COLOR } from './sprite-fill-color'

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
})
