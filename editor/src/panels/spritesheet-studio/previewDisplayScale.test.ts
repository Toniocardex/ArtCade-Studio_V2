import { describe, expect, it } from 'vitest'
import { previewDisplayScale } from './SpritesheetEnginePreview'

describe('previewDisplayScale', () => {
  it('scales small frames up for readable preview', () => {
    expect(previewDisplayScale(16, 16)).toBe(10)
    expect(previewDisplayScale(32, 32)).toBe(5)
  })

  it('caps scale for large frames', () => {
    expect(previewDisplayScale(128, 64)).toBe(3)
  })
})
