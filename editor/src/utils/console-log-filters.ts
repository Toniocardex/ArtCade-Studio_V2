import type { ConsoleEntry, ConsoleLevel } from '../types'

export type ConsoleFilterKey = 'error' | 'warn' | 'info'

export type ConsoleLevelFilters = Readonly<Record<ConsoleFilterKey, boolean>>

export const DEFAULT_CONSOLE_FILTERS: ConsoleLevelFilters = {
  error: true,
  warn: true,
  info: true,
}

export type ConsoleLevelCounts = Readonly<Record<ConsoleFilterKey, number>>

/** Map log levels to the three mock filter chips (lua → Info). */
export function consoleLevelToFilterKey(level: ConsoleLevel): ConsoleFilterKey {
  if (level === 'error') return 'error'
  if (level === 'warn') return 'warn'
  return 'info'
}

export function countConsoleLogsByFilter(logs: readonly ConsoleEntry[]): ConsoleLevelCounts {
  let error = 0
  let warn = 0
  let info = 0
  for (const entry of logs) {
    const key = consoleLevelToFilterKey(entry.level)
    if (key === 'error') error += 1
    else if (key === 'warn') warn += 1
    else info += 1
  }
  return { error, warn, info }
}

export function normalizeConsoleSearch(query: string): string {
  return query.trim().toLowerCase()
}

export function filterConsoleLogs(
  logs: readonly ConsoleEntry[],
  filters: ConsoleLevelFilters,
  searchQuery: string,
): ConsoleEntry[] {
  const q = normalizeConsoleSearch(searchQuery)
  return logs.filter((entry) => {
    const key = consoleLevelToFilterKey(entry.level)
    if (!filters[key]) return false
    if (!q) return true
    return (
      entry.message.toLowerCase().includes(q)
      || entry.level.toLowerCase().includes(q)
      || entry.time.toLowerCase().includes(q)
    )
  })
}
