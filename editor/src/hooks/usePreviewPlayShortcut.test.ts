import { describe, expect, it } from 'vitest'
import { shouldTogglePreviewPlay } from './usePreviewPlayShortcut'

function key(
  partial: Partial<KeyboardEvent> & { key: string },
): Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'> {
  return {
    code: partial.key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    ...partial,
  }
}

describe('shouldTogglePreviewPlay', () => {
  it('accepts plain F5', () => {
    expect(shouldTogglePreviewPlay(key({ key: 'F5' }))).toBe(true)
    expect(shouldTogglePreviewPlay(key({ key: 'Unidentified', code: 'F5' }))).toBe(true)
  })

  it('rejects P and other keys', () => {
    expect(shouldTogglePreviewPlay(key({ key: 'p' }))).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: 'P' }))).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: ' ' }))).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: 'Space' }))).toBe(false)
  })

  it('rejects modified F5', () => {
    expect(shouldTogglePreviewPlay(key({ key: 'F5', ctrlKey: true }))).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: 'F5', altKey: true }))).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: 'F5', metaKey: true }))).toBe(false)
    expect(shouldTogglePreviewPlay(key({ key: 'F5', shiftKey: true }))).toBe(false)
  })
})
