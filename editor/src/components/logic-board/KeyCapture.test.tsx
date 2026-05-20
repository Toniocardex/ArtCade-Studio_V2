import { describe, expect, it } from 'vitest'
import { formatKeyLabel } from './KeyCapture'

describe('formatKeyLabel', () => {
  it('maps common KeyboardEvent.code values', () => {
    expect(formatKeyLabel('')).toBe('—')
    expect(formatKeyLabel('Space')).toBe('Space')
    expect(formatKeyLabel('KeyW')).toBe('W')
    expect(formatKeyLabel('Digit1')).toBe('1')
    expect(formatKeyLabel('ArrowUp')).toBe('Up')
  })
})
