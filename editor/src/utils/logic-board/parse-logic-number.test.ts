import { describe, expect, it } from 'vitest'
import { parseLogicNumber } from './parse-logic-number'

describe('parseLogicNumber', () => {
  it('parses comma decimals', () => {
    expect(parseLogicNumber('0,5')).toBe(0.5)
    expect(parseLogicNumber('8,5')).toBe(8.5)
  })

  it('returns undefined for empty input', () => {
    expect(parseLogicNumber('')).toBeUndefined()
    expect(parseLogicNumber('   ')).toBeUndefined()
  })
})
