import { describe, it, expect } from 'vitest'
import { volatileReducer } from './volatile-reducer'
import { initialVolatileState } from '../editor-store-state'
import type { ConsoleEntry } from '../../types'

function entry(id: number, level: ConsoleEntry['level'] = 'info'): ConsoleEntry {
  return { id, time: '12:00:00', message: 'test', level }
}

describe('volatileReducer — LOG', () => {
  it('appends a new entry', () => {
    const next = volatileReducer(initialVolatileState, { type: 'LOG', entry: entry(1) })
    const ids = next.consoleLogs.map((e) => e.id)
    expect(ids).toContain(1)
  })

  it('is idempotent: duplicate id is not appended twice (StrictMode double-invoke)', () => {
    const e = entry(901)
    const once = volatileReducer(initialVolatileState, { type: 'LOG', entry: e })
    const twice = volatileReducer(once, { type: 'LOG', entry: e })
    const count = twice.consoleLogs.filter((x) => x.id === 901).length
    expect(count).toBe(1)
  })

  it('does append entries with distinct ids', () => {
    const s1 = volatileReducer(initialVolatileState, { type: 'LOG', entry: entry(1) })
    const s2 = volatileReducer(s1, { type: 'LOG', entry: entry(2) })
    expect(s2.consoleLogs.filter((e) => e.id === 1 || e.id === 2).length).toBe(2)
  })
})

describe('volatileReducer — SET_CURSOR', () => {
  it('skips update when coordinates unchanged', () => {
    const s = volatileReducer(initialVolatileState, { type: 'SET_CURSOR', x: 0, y: 0 })
    expect(s).toBe(initialVolatileState)
  })

  it('updates cursor when coordinates change', () => {
    const s = volatileReducer(initialVolatileState, { type: 'SET_CURSOR', x: 10, y: 20 })
    expect(s.cursorPos).toEqual({ x: 10, y: 20 })
  })
})
