import { useEffect, useMemo, useRef, useState } from 'react'
import { isTauri }         from '@tauri-apps/api/core'
import { listen }          from '@tauri-apps/api/event'
import { useConsoleLogs }  from '../store/editor-store'
import type { ConsoleLevel } from '../types'

const LEVEL_COLOR: Record<ConsoleLevel, string> = {
  info:  'var(--muted)',   // gray
  lua:   'var(--accent)',   // cyan
  warn:  'var(--warn)',   // orange
  error: 'var(--danger-2)',   // red
}

const LEVEL_LABEL: Record<ConsoleLevel, string> = {
  info:  'INFO ',
  lua:   'LUA  ',
  warn:  'WARN ',
  error: 'ERROR',
}

export default function ConsolePanel() {
  const { state, dispatch } = useConsoleLogs()
  const { consoleLogs } = state
  const bottomRef = useRef<HTMLDivElement>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const allLogText = useMemo(() => consoleLogs
    .map(entry => `[${entry.time}] ${LEVEL_LABEL[entry.level]} ${entry.message}`)
    .join('\n'), [consoleLogs])

  const errorLogText = useMemo(() => consoleLogs
    .filter(entry => entry.level === 'error' || entry.level === 'warn')
    .map(entry => `[${entry.time}] ${LEVEL_LABEL[entry.level]} ${entry.message}`)
    .join('\n'), [consoleLogs])

  async function copyText(text: string, label: string) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus(`${label} COPIED`)
      window.setTimeout(() => setCopyStatus(null), 1600)
    } catch {
      setCopyStatus('COPY FAILED')
      window.setTimeout(() => setCopyStatus(null), 1600)
    }
  }

  // Subscribe to "build-log" events emitted by the Tauri Rust backend
  // (cmake --build / python pack-artcade.py output streamed line-by-line).
  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    let unlisten: (() => void) | null = null

    listen<{ message: string; level: string }>('build-log', event => {
      if (cancelled) return
      const raw = event.payload
      const level = (['info', 'warn', 'error', 'lua'] as ConsoleLevel[]).includes(
        raw.level as ConsoleLevel
      ) ? (raw.level as ConsoleLevel) : 'info'

      dispatch({
        type: 'LOG',
        entry: {
          id:      Date.now() + Math.random(),   // unique enough
          time:    new Date().toLocaleTimeString('it-IT', {
                     hour: '2-digit', minute: '2-digit', second: '2-digit',
                   }),
          message: raw.message,
          level,
        },
      })
    }).then(fn => {
      if (cancelled) fn()   // already unmounted — release immediately
      else unlisten = fn
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [dispatch])

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleLogs.length])

  return (
    <div className="h-full flex flex-col bg-black/30">
      <div className="h-8 flex items-center justify-between px-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copyText(allLogText, 'LOGS')}
            disabled={!consoleLogs.length}
            className="px-2 py-1 rounded border border-[var(--border)] text-[9px] font-bold text-[var(--muted)]
                       hover:text-white hover:border-[rgb(var(--accent-rgb)/0.6)] disabled:opacity-40 disabled:hover:text-[var(--muted)]
                       disabled:hover:border-[var(--border)]"
          >
            COPY ALL
          </button>
          <button
            type="button"
            onClick={() => copyText(errorLogText, 'ERRORS')}
            disabled={!errorLogText}
            className="px-2 py-1 rounded border border-[var(--border)] text-[9px] font-bold text-[var(--warn)]
                       hover:text-white hover:border-[rgb(var(--warn-rgb)/0.7)] disabled:opacity-40 disabled:hover:text-[var(--warn)]
                       disabled:hover:border-[var(--border)]"
          >
            COPY ERRORS
          </button>
        </div>
        {copyStatus && (
          <span className="text-[9px] font-mono text-[var(--accent)]">{copyStatus}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono select-text">
        {consoleLogs.map(entry => (
          <div key={entry.id} className="flex items-start gap-3 text-[10px] leading-5">
            <span className="text-[rgb(var(--muted-rgb)/0.5)] flex-shrink-0">[{entry.time}]</span>
            <span
              className="flex-shrink-0 font-bold"
              style={{ color: LEVEL_COLOR[entry.level] }}
            >
              {LEVEL_LABEL[entry.level]}
            </span>
            <span className="whitespace-pre-wrap break-words" style={{ color: LEVEL_COLOR[entry.level] }}>
              {entry.message}
            </span>
          </div>
        ))}

        {/* Blinking cursor */}
        <div className="text-white text-[10px] animate-pulse">&gt; _</div>
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border)]">
        <span className="text-[var(--accent)] text-[10px]">&gt;</span>
        <input
          type="text"
          placeholder="Enter Lua expression…"
          className="flex-1 bg-transparent text-[10px] text-[var(--text)] outline-none
                     placeholder:text-[rgb(var(--muted-rgb)/0.4)]"
        />
      </div>
    </div>
  )
}
