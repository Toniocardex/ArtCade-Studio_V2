import { describe, it, expect } from 'vitest'
import { surfaceHex, textHex, THEME_SURFACE_RGB } from './boot-chrome'

describe('boot-chrome', () => {
  it('surfaceHex matches boot-surfaces.json', () => {
    expect(surfaceHex('dark')).toBe('#111113')
    expect(surfaceHex('light')).toBe('#E4E4E7')
    expect(textHex('dark')).toBe('#D4D4D8')
    expect(textHex('light')).toBe('#18181B')
  })

  it('THEME_SURFACE_RGB matches hex surfaces', () => {
    expect(THEME_SURFACE_RGB.dark).toEqual({ red: 17, green: 17, blue: 19 })
    expect(THEME_SURFACE_RGB.light).toEqual({ red: 228, green: 228, blue: 231 })
  })
})
