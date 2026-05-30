import { describe, it, expect } from 'vitest'
import { surfaceHex, textHex, THEME_SURFACE_RGB } from './boot-chrome'

describe('boot-chrome', () => {
  it('surfaceHex matches boot-surfaces.json', () => {
    expect(surfaceHex('dark')).toBe('#1A1A1A')
    expect(surfaceHex('light')).toBe('#535353')
    expect(textHex('dark')).toBe('#EAEAEA')
    expect(textHex('light')).toBe('#E0E0E0')
  })

  it('THEME_SURFACE_RGB matches hex surfaces', () => {
    expect(THEME_SURFACE_RGB.dark).toEqual({ red: 26, green: 26, blue: 26 })
    expect(THEME_SURFACE_RGB.light).toEqual({ red: 83, green: 83, blue: 83 })
  })
})
