import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useConsoleLogs, useEditor } from '../store/editor-store'
import type { ConsoleLevel } from '../types'
import { ConsoleFilterBar } from '../components/console/ConsoleFilterBar'
import {
  consoleChipCounts,
  consoleEmptyListMessage,
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
    if (
      typeof parsed.error === 'boolean'
      && typeof parsed.warn === 'boolean'
      && typeof parsed.info === 'boolean'
    ) {
      return { error: parsed.error, warn: parsed.warn, info: parsed.info }
    }
    return DEFAULT_CONSOLE_FILTERS
  } catch {
    return DEFAULT_CONSOLE_FILTERS
  }
}

export default function ConsolePanel() {
  const { dispatch } = useEditor()
  const { state } = useConsoleLogs()
  const { consoleLogs } = state
  const [commandLine, setCommandLine] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastScrolledLogIdRef = useRef(0)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [filters, setFilters] = useState<ConsoleLevelFilters>(readStoredFilters)
  const [search, setSearch] = useState('')

  const chipCounts = useMemo(
    () => consoleChipCounts(consoleLogs, search),
    [consoleLogs, search],
  )

  const emptyMessage = useMemo(
    () => consoleEmptyListMessage(consoleLogs, filters, search),
    [consoleLogs, filters, search],
  )

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
    if (!consoleLogs.length) return
    const maxId = consoleLogs.reduce((max, entry) => (entry.id > max ? entry.id : max), 0)
    if (maxId <= lastScrolledLogIdRef.current) return
    lastScrolledLogIdRef.current = maxId
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleLogs])

  return (
    <div className="h-full flex flex-col bg-[var(--panel-3)]" data-panel="console">
      <ConsoleFilterBar
        filters={filters}
        counts={chipCounts}
        searchActive={search.trim().length > 0}
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
          <p className="text-[10px] text-[var(--muted)] italic py-2">{emptyMessage}</p>
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

      <form
        className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border)] flex-shrink-0"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          const line = commandLine.trim()
          if (!line) return
          dispatch({
            type: 'LOG',
            entry: {
              id: Date.now(),
              time: new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              message: `[Console] ${line} (REPL evaluation not wired — logged only)`,
              level: 'lua',
            },
          })
          setCommandLine('')
        }}
      >
        <span className="text-[var(--accent)] text-[10px]">&gt;</span>
        <input
          type="text"
          value={commandLine}
          onChange={(e) => setCommandLine(e.target.value)}
          placeholder="Lua expression (log only)…"
          title="Console command line — logs input; full Lua eval in a future release"
          className="flex-1 bg-transparent text-[10px] text-[var(--text)] outline-none
                     placeholder:text-[rgb(var(--muted-rgb)/0.4)]"
        />
      </form>
    </div>
  )
}
