import { describe, it, expect } from 'vitest'
import { surfaceHex, textHex, THEME_SURFACE_RGB } from './boot-chrome'

describe('boot-chrome', () => {
  it('surfaceHex matches boot-surfaces.json', () => {
    expect(surfaceHex('dark')).toBe('#050505')
    expect(surfaceHex('light')).toBe('#404040')
    expect(textHex('dark')).toBe('#F2F2F2')
    expect(textHex('light')).toBe('#E0E0E0')
  })

  it('THEME_SURFACE_RGB matches hex surfaces', () => {
    expect(THEME_SURFACE_RGB.dark).toEqual({ red: 5, green: 5, blue: 5 })
    expect(THEME_SURFACE_RGB.light).toEqual({ red: 64, green: 64, blue: 64 })
  })
})
