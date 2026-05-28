// ---------------------------------------------------------------------------
// ConsoleDock — dedicated bottom panel for build/runtime logs (no asset tabs).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { Minus } from 'lucide-react'
import { useEditor, useConsoleLogs } from '../store/editor-store'
import { usePersistedHeight } from '../hooks/usePersistedHeight'
import { useBuildLogListener } from '../hooks/useBuildLogListener'
import { triggerLayoutReflow } from '../utils/layout-reflow'
import VerticalResizeHandle from './VerticalResizeHandle'
import ConsolePanel from '../panels/ConsolePanel'

const HANDLE_H = 4
const HEADER_H = 28
/** Total dock height (handle + header + ConsolePanel). ~260px ≈ 5–6 log lines + input bar. */
const DEFAULT_HEIGHT = 260
const MIN_CONTENT_H = 160
const MIN_TOTAL_H = HANDLE_H + HEADER_H + MIN_CONTENT_H
/** Heights saved before the layout-A retune were too small to read logs. */
const LEGACY_HEIGHT_CEILING = 220

function maxDockHeight(): number {
  if (globalThis.window === undefined) return 480
  return Math.max(MIN_TOTAL_H, Math.round(globalThis.innerHeight * 0.38))
}

function clampDockHeight(n: number): number {
  return Math.max(MIN_TOTAL_H, Math.min(maxDockHeight(), Math.round(n)))
}

function readInitialHeight(): number {
  if (globalThis.window === undefined) return DEFAULT_HEIGHT
  const v4 = globalThis.localStorage.getItem('artcade.console-dock-h-v4')
  if (v4) {
    const n = Number(v4)
    if (Number.isFinite(n)) return clampDockHeight(n)
  }
  const v3 = globalThis.localStorage.getItem('artcade.console-dock-h-v3')
  if (v3) {
    const n = Number(v3)
    if (Number.isFinite(n)) {
      return clampDockHeight(n < LEGACY_HEIGHT_CEILING ? DEFAULT_HEIGHT : n)
    }
  }
  const v2 = globalThis.localStorage.getItem('artcade.bottom-dock-h-v2')
  if (v2) {
    const n = Number(v2)
    if (Number.isFinite(n)) {
      return clampDockHeight(n < LEGACY_HEIGHT_CEILING ? DEFAULT_HEIGHT : n)
    }
  }
  return DEFAULT_HEIGHT
}

export default function ConsoleDock() {
  const { state, dispatch } = useEditor()
  const { state: volatile } = useConsoleLogs()
  const { bottomPanelCollapsed, consoleAckUpToId } = state

  useBuildLogListener()

  const [maxH, setMaxH] = useState(maxDockHeight)
  const [height, setHeight] = usePersistedHeight(
    'artcade.console-dock-h-v4',
    readInitialHeight(),
    MIN_TOTAL_H,
    maxH,
  )

  useEffect(() => {
    function onResize() {
      setMaxH(maxDockHeight())
    }
    globalThis.addEventListener('resize', onResize)
    return () => globalThis.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setHeight((h) => Math.min(h, maxH))
  }, [maxH, setHeight])

  useEffect(() => {
    triggerLayoutReflow()
  }, [height, bottomPanelCollapsed])

  const consoleVisible = !bottomPanelCollapsed

  useEffect(() => {
    if (!consoleVisible || !volatile.consoleLogs.length) return
    const maxId = Math.max(...volatile.consoleLogs.map((e) => e.id))
    dispatch({ type: 'ACKNOWLEDGE_CONSOLE_LOGS', upToId: maxId })
  }, [consoleVisible, volatile.consoleLogs, dispatch])

  const issueCount = useMemo(() => {
    if (consoleVisible) return 0
    return volatile.consoleLogs.filter(
      (e) => (e.level === 'warn' || e.level === 'error') && e.id > consoleAckUpToId,
    ).length
  }, [volatile.consoleLogs, consoleVisible, consoleAckUpToId])

  const panelHeight = bottomPanelCollapsed ? HEADER_H : height

  function toggleCollapsed() {
    dispatch({
      type: 'SET_BOTTOM_PANEL_COLLAPSED',
      collapsed: !bottomPanelCollapsed,
    })
  }

  return (
    <div
      className="flex flex-col flex-shrink-0 border-t border-[var(--border)] bg-[var(--panel)]
                 transition-[height] duration-100"
      style={{ height: panelHeight }}
    >
      {!bottomPanelCollapsed && (
        <VerticalResizeHandle onResize={(d) => setHeight((h) => h + d)} />
      )}

      <div className="h-7 flex items-center justify-between border-b border-[var(--border)] flex-shrink-0 px-2">
        <span className="text-[10px] tracking-wider uppercase font-semibold text-[var(--muted)] flex items-center gap-1.5">
          Console
          {issueCount > 0 && (
            <span
              className="inline-flex min-w-[14px] h-[14px] px-1 items-center justify-center rounded-full
                         bg-[var(--danger-2)] text-[8px] font-bold text-white leading-none"
              title={`${issueCount} unread warning(s) / error(s)`}
            >
              {issueCount > 99 ? '99+' : issueCount}
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={toggleCollapsed}
          title={bottomPanelCollapsed ? 'Expand console' : 'Collapse console'}
          aria-label={bottomPanelCollapsed ? 'Expand console' : 'Collapse console'}
          className="w-7 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
        >
          <Minus size={12} />
        </button>
      </div>

      {!bottomPanelCollapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ConsolePanel />
        </div>
      )}
    </div>
  )
}
