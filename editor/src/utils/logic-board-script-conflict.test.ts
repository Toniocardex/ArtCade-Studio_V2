import { describe, expect, it } from 'vitest'
import {
  logicBoardScriptOutOfSync,
  normalizeScriptText,
} from './logic-board-script-conflict'

describe('logicBoardScriptOutOfSync', () => {
  it('returns false for identical content', () => {
    expect(logicBoardScriptOutOfSync('a\nb', 'a\nb')).toBe(false)
  })

  it('returns false when only CRLF vs LF differs', () => {
    expect(logicBoardScriptOutOfSync('a\r\nb', 'a\nb')).toBe(false)
  })

  it('returns true when editor text was edited by hand', () => {
    expect(logicBoardScriptOutOfSync('-- hand\n', '-- generated\n')).toBe(true)
  })
})

describe('normalizeScriptText', () => {
  it('trims trailing whitespace on last line only', () => {
    expect(normalizeScriptText('x  \n')).toBe('x')
  })
})
