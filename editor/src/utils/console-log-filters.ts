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

export function hasAnyConsoleFilterActive(filters: ConsoleLevelFilters): boolean {
  return filters.error || filters.warn || filters.info
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

/** Chip badge counts: totals when no search; per-level search hits when searching. */
export function consoleChipCounts(
  logs: readonly ConsoleEntry[],
  searchQuery: string,
): ConsoleLevelCounts {
  const q = normalizeConsoleSearch(searchQuery)
  if (!q) return countConsoleLogsByFilter(logs)
  return countConsoleLogsByFilter(
    filterConsoleLogs(logs, DEFAULT_CONSOLE_FILTERS, searchQuery),
  )
}

export function consoleEmptyListMessage(
  logs: readonly ConsoleEntry[],
  filters: ConsoleLevelFilters,
  searchQuery: string,
): string {
  if (logs.length === 0) return 'No log output yet.'
  if (!hasAnyConsoleFilterActive(filters)) {
    return 'All level filters are off — enable Errors, Warnings, or Info.'
  }
  if (normalizeConsoleSearch(searchQuery)) {
    return 'No logs match the current search.'
  }
  return 'No logs match the enabled level filters.'
}
