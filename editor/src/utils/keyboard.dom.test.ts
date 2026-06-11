// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { shouldBlockNativeKeyDefault } from './keyboard'

function kev(
  partial: Partial<KeyboardEvent> & { key: string },
  target?: EventTarget | null,
): KeyboardEvent {
  return {
    key: partial.key,
    code: partial.code ?? partial.key,
    ctrlKey: partial.ctrlKey ?? false,
    altKey: partial.altKey ?? false,
    metaKey: partial.metaKey ?? false,
    shiftKey: partial.shiftKey ?? false,
    target: target !== undefined ? target : document.body,
  } as unknown as KeyboardEvent
}

describe('shouldBlockNativeKeyDefault', () => {
  it('blocks Backspace outside editable targets', () => {
    expect(shouldBlockNativeKeyDefault(kev({ key: 'Backspace' }))).toBe(true)
  })

  it('does not block Backspace inside an input', () => {
    const input = document.createElement('input')
    expect(shouldBlockNativeKeyDefault(kev({ key: 'Backspace' }, input))).toBe(false)
  })

  it('blocks plain F5', () => {
    expect(shouldBlockNativeKeyDefault(kev({ key: 'F5' }))).toBe(true)
    expect(shouldBlockNativeKeyDefault(kev({ key: 'Unidentified', code: 'F5' }))).toBe(true)
  })

  it('does not block modified F5', () => {
    expect(shouldBlockNativeKeyDefault(kev({ key: 'F5', ctrlKey: true }))).toBe(false)
    expect(shouldBlockNativeKeyDefault(kev({ key: 'F5', altKey: true }))).toBe(false)
    expect(shouldBlockNativeKeyDefault(kev({ key: 'F5', shiftKey: true }))).toBe(false)
  })

  it('does not block other function keys', () => {
    expect(shouldBlockNativeKeyDefault(kev({ key: 'F1' }))).toBe(false)
    expect(shouldBlockNativeKeyDefault(kev({ key: 'F11' }))).toBe(false)
    expect(shouldBlockNativeKeyDefault(kev({ key: 'Enter' }))).toBe(false)
  })
})
