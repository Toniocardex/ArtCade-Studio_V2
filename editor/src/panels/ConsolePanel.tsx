import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConsoleLogs } from '../store/editor-store'
import type { ConsoleLevel } from '../types'
import { ConsoleFilterBar } from '../components/console/ConsoleFilterBar'
import {
  countConsoleLogsByFilter,
  DEFAULT_CONSOLE_FILTERS,
  filterConsoleLogs,
  type ConsoleFilterKey,
  type ConsoleLevelFilters,
} from '../utils/console-log-filters'

const LEVEL_COLOR: Record<ConsoleLevel, string> = {
  info: 'var(--muted)',
  lua: 'var(--accent)',
  warn: 'var(--warn)',
  error: 'var(--danger-2)',
}

const LEVEL_LABEL: Record<ConsoleLevel, string> = {
  info: 'INFO ',
  lua: 'LUA  ',
  warn: 'WARN ',
  error: 'ERROR',
}

const FILTERS_STORAGE_KEY = 'artcade.console-filters.v1'

function readStoredFilters(): ConsoleLevelFilters {
  if (globalThis.window === undefined) return DEFAULT_CONSOLE_FILTERS
  try {
    const raw = globalThis.localStorage.getItem(FILTERS_STORAGE_KEY)
    if (!raw) return DEFAULT_CONSOLE_FILTERS
    const parsed = JSON.parse(raw) as Partial<ConsoleLevelFilters>
    return {
      error: parsed.error !== false,
      warn: parsed.warn !== false,
      info: parsed.info !== false,
    }
  } catch {
    return DEFAULT_CONSOLE_FILTERS
  }
}

export default function ConsolePanel() {
  const { state } = useConsoleLogs()
  const { consoleLogs } = state
  const bottomRef = useRef<HTMLDivElement>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [filters, setFilters] = useState<ConsoleLevelFilters>(readStoredFilters)
  const [search, setSearch] = useState('')

  const counts = useMemo(() => countConsoleLogsByFilter(consoleLogs), [consoleLogs])

  const visibleLogs = useMemo(
    () => filterConsoleLogs(consoleLogs, filters, search),
    [consoleLogs, filters, search],
  )

  const allLogText = useMemo(
    () => visibleLogs
      .map((entry) => `[${entry.time}] ${LEVEL_LABEL[entry.level]} ${entry.message}`)
      .join('\n'),
    [visibleLogs],
  )

  const errorLogText = useMemo(
    () => visibleLogs
      .filter((entry) => entry.level === 'error' || entry.level === 'warn')
      .map((entry) => `[${entry.time}] ${LEVEL_LABEL[entry.level]} ${entry.message}`)
      .join('\n'),
    [visibleLogs],
  )

  useEffect(() => {
    if (globalThis.window === undefined) return
    globalThis.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
  }, [filters])

  const toggleFilter = useCallback((key: ConsoleFilterKey) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const clearCopyStatus = useCallback(() => {
    setCopyStatus(null)
  }, [])

  async function copyText(text: string, label: string) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus(`${label} COPIED`)
    } catch {
      setCopyStatus('COPY FAILED')
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleLogs.length, consoleLogs.length])

  return (
    <div className="h-full flex flex-col bg-[var(--panel-3)]" data-panel="console">
      <ConsoleFilterBar
        filters={filters}
        counts={counts}
        search={search}
        onToggle={toggleFilter}
        onSearchChange={setSearch}
      />

      <div className="h-7 flex items-center justify-between px-3 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copyText(allLogText, 'LOGS')}
            disabled={!visibleLogs.length}
            className="px-2 py-1 rounded border border-[var(--border)] text-[9px] font-bold text-[var(--muted)]
                       hover:text-[var(--text)] hover:border-[rgb(var(--accent-rgb)/0.6)] disabled:opacity-40"
          >
            COPY VISIBLE
          </button>
          <button
            type="button"
            onClick={() => copyText(errorLogText, 'ERRORS')}
            disabled={!errorLogText}
            className="px-2 py-1 rounded border border-[var(--border)] text-[9px] font-bold text-[var(--warn)]
                       hover:text-[var(--text)] hover:border-[rgb(var(--warn-rgb)/0.7)] disabled:opacity-40"
          >
            COPY ERRORS
          </button>
        </div>
        {copyStatus ? (
          <span
            key={copyStatus}
            className="asset-flash-msg text-[9px] font-mono text-[var(--accent)]"
            onAnimationEnd={clearCopyStatus}
          >
            {copyStatus}
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono select-text min-h-0">
        {visibleLogs.length === 0 ? (
          <p className="text-[10px] text-[var(--muted)] italic py-2">
            {consoleLogs.length === 0
              ? 'No log output yet.'
              : 'No logs match the current filters.'}
          </p>
        ) : (
          visibleLogs.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 text-[10px] leading-5">
              <span className="text-[rgb(var(--muted-rgb)/0.5)] flex-shrink-0">[{entry.time}]</span>
              <span
                className="flex-shrink-0 font-bold"
                style={{ color: LEVEL_COLOR[entry.level] }}
              >
                {LEVEL_LABEL[entry.level]}
              </span>
              <span
                className="whitespace-pre-wrap break-words"
                style={{ color: LEVEL_COLOR[entry.level] }}
              >
                {entry.message}
              </span>
            </div>
          ))
        )}

        <div className="text-[var(--accent)] text-[10px] animate-pulse">&gt; _</div>
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border)] flex-shrink-0">
        <span className="text-[var(--accent)] text-[10px]">&gt;</span>
        <input
          type="text"
          placeholder="Enter Lua expression…"
          disabled
          title="Command line — coming in a later release"
          className="flex-1 bg-transparent text-[10px] text-[var(--muted)] outline-none
                     placeholder:text-[rgb(var(--muted-rgb)/0.4)] cursor-not-allowed"
        />
      </div>
    </div>
  )
}
