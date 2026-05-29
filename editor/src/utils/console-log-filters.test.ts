import { describe, expect, it } from 'vitest'
import {
  consoleChipCounts,
  consoleEmptyListMessage,
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

  it('chip counts reflect search when query is set', () => {
    expect(consoleChipCounts(logs, '')).toEqual({ error: 1, warn: 1, info: 2 })
    expect(consoleChipCounts(logs, 'tick')).toEqual({ error: 0, warn: 0, info: 1 })
  })

  it('empty list message distinguishes no logs, filters, and search', () => {
    expect(consoleEmptyListMessage([], DEFAULT_CONSOLE_FILTERS, '')).toBe('No log output yet.')
    expect(
      consoleEmptyListMessage(logs, { error: false, warn: false, info: false }, ''),
    ).toBe('All level filters are off — enable Errors, Warnings, or Info.')
    expect(consoleEmptyListMessage(logs, DEFAULT_CONSOLE_FILTERS, 'nope')).toBe(
      'No logs match the current search.',
    )
    expect(
      consoleEmptyListMessage(logs, { error: true, warn: false, info: false }, ''),
    ).toBe('No logs match the enabled level filters.')
  })
})
