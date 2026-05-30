import { describe, it, expect } from 'vitest'
import { surfaceHex, textHex, THEME_SURFACE_RGB } from './boot-chrome'

describe('boot-chrome', () => {
  it('surfaceHex matches boot-surfaces.json', () => {
    expect(surfaceHex('dark')).toBe('#0E1113')
    expect(surfaceHex('light')).toBe('#404040')
    expect(textHex('dark')).toBe('#D8DEE3')
    expect(textHex('light')).toBe('#E0E0E0')
  })

  it('THEME_SURFACE_RGB matches hex surfaces', () => {
    expect(THEME_SURFACE_RGB.dark).toEqual({ red: 14, green: 17, blue: 19 })
    expect(THEME_SURFACE_RGB.light).toEqual({ red: 64, green: 64, blue: 64 })
  })
})
