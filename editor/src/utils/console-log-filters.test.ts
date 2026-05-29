import { describe, expect, it } from 'vitest'
import {
  countConsoleLogsByFilter,
  filterConsoleLogs,
  DEFAULT_CONSOLE_FILTERS,
} from './console-log-filters'
import type { ConsoleEntry } from '../types'

function entry(id: number, level: ConsoleEntry['level'], message: string): ConsoleEntry {
  return { id, time: '12:00:00', level, message }
}

describe('console-log-filters', () => {
  const logs = [
    entry(1, 'error', 'Build failed'),
    entry(2, 'warn', 'Low memory'),
    entry(3, 'info', 'Project loaded'),
    entry(4, 'lua', 'tick ok'),
  ]

  it('counts errors, warnings, and info+lua', () => {
    expect(countConsoleLogsByFilter(logs)).toEqual({ error: 1, warn: 1, info: 2 })
  })

  it('filters by level chip', () => {
    const onlyErrors = filterConsoleLogs(logs, { error: true, warn: false, info: false }, '')
    expect(onlyErrors.map((e) => e.id)).toEqual([1])
  })

  it('filters by search text', () => {
    const hits = filterConsoleLogs(logs, DEFAULT_CONSOLE_FILTERS, 'tick')
    expect(hits.map((e) => e.id)).toEqual([4])
  })

  it('returns empty when all chips off', () => {
    expect(
      filterConsoleLogs(logs, { error: false, warn: false, info: false }, ''),
    ).toHaveLength(0)
  })
})
