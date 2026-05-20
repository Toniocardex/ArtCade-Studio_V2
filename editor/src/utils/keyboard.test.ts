import { describe, it, expect } from 'vitest'
import { applyInputBackspace, isBackspaceKey } from './keyboard'

describe('keyboard helpers', () => {
  it('isBackspaceKey matches key and code', () => {
    expect(isBackspaceKey({ key: 'Backspace', code: 'Backspace' })).toBe(true)
    expect(isBackspaceKey({ key: 'Delete', code: 'Delete' })).toBe(false)
  })

  it('applyInputBackspace removes the previous character', () => {
    const input = { value: 'Player', selectionStart: 6, selectionEnd: 6, setSelectionRange: () => {}, dispatchEvent: () => true } as unknown as HTMLInputElement
    expect(applyInputBackspace(input)).toBe(true)
    expect(input.value).toBe('Playe')
  })

  it('applyInputBackspace is no-op at start of string', () => {
    const input = { value: 'A', selectionStart: 0, selectionEnd: 0, setSelectionRange: () => {}, dispatchEvent: () => true } as unknown as HTMLInputElement
    expect(applyInputBackspace(input)).toBe(false)
    expect(input.value).toBe('A')
  })
})
