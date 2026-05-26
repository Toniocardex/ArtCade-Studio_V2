import { describe, expect, it } from 'vitest'
import { shouldTogglePreviewPlay } from './usePreviewPlayShortcut'

function key(
  partial: Partial<KeyboardEvent> & { key: string },
): Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'> {
  return {
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...partial,
  }
}

describe('shouldTogglePreviewPlay', () => {
  it('accepts P in canvas mode', () => {
    expect(shouldTogglePreviewPlay(key({ key: 'p' }), 'canvas')).toBe(true)
    expect(shouldTogglePreviewPlay(key({ key: 'P' }), 'canvas')).toBe(true)
  })

  it('rejects other modes and keys', () => {
    expect(shouldTogglePreviewPlay(key({ key: 'p' }), 'logic')).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: ' ' }), 'canvas')).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: 'Space' }), 'canvas')).toBe(false)
  })

  it('rejects modified P', () => {
    expect(shouldTogglePreviewPlay(key({ key: 'p', ctrlKey: true }), 'canvas')).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: 'p', altKey: true }), 'canvas')).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: 'p', metaKey: true }), 'canvas')).toBe(false)
  })
})
