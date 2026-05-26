// ---------------------------------------------------------------------------
// BottomDock — tabbed bottom panel (Assets | Console), docked in layout flow.
// Replaces the old ConsoleOverlay + inline AssetsStrip.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { Minus } from 'lucide-react'
import { useEditor, useConsoleLogs } from '../store/editor-store'
import { usePersistedHeight } from '../hooks/usePersistedHeight'
import { useBuildLogListener } from '../hooks/useBuildLogListener'
import { triggerLayoutReflow } from '../utils/layout-reflow'
import VerticalResizeHandle from './VerticalResizeHandle'
import AssetBrowserPanel from '../panels/AssetBrowserPanel'
import ConsolePanel from '../panels/ConsolePanel'

const HANDLE_H = 4
const TAB_BAR_H = 28
/** Total outer height when expanded (handle + tab bar + content). */
const DEFAULT_HEIGHT = 128
const MIN_CONTENT_H = 92
const MIN_TOTAL_H = HANDLE_H + TAB_BAR_H + MIN_CONTENT_H

function maxDockHeight(): number {
  if (typeof window === 'undefined') return 400
  return Math.max(MIN_TOTAL_H, Math.round(window.innerHeight * 0.45))
}

export default function BottomDock() {
  const { state, dispatch } = useEditor()
  const { state: volatile } = useConsoleLogs()
  const { mode, bottomPanelTab, bottomPanelCollapsed, consoleAckUpToId } = state
  const showAssetsTab = mode === 'canvas'

  useBuildLogListener()

  const [maxH, setMaxH] = useState(maxDockHeight)
  const [height, setHeight] = usePersistedHeight(
    'artcade.bottom-dock-h-v2',
    DEFAULT_HEIGHT,
    MIN_TOTAL_H,
    maxH,
  )

  useEffect(() => {
    function onResize() {
      setMaxH(maxDockHeight())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setHeight((h) => Math.min(h, maxH))
  }, [maxH, setHeight])

  useEffect(() => {
    triggerLayoutReflow()
  }, [height, bottomPanelCollapsed, bottomPanelTab])

  const activeTab = showAssetsTab ? bottomPanelTab : 'console'
  const consoleVisible = !bottomPanelCollapsed && activeTab === 'console'

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

  const panelHeight = bottomPanelCollapsed ? TAB_BAR_H : height

  function selectTab(tab: 'assets' | 'console') {
    dispatch({ type: 'SET_BOTTOM_PANEL_TAB', tab })
  }

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

      <div className="h-7 flex items-center justify-between border-b border-[var(--border)] flex-shrink-0 px-1">
        <div className="flex items-center gap-0.5 min-w-0">
          {showAssetsTab && (
            <button
              type="button"
              onClick={() => selectTab('assets')}
              className={`px-2.5 h-6 rounded text-[10px] tracking-wider uppercase font-semibold transition-colors ${
                activeTab === 'assets'
                  ? 'bg-[rgb(var(--accent-rgb)/0.15)] text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              Assets
            </button>
          )}
          <button
            type="button"
            onClick={() => selectTab('console')}
            className={`px-2.5 h-6 rounded text-[10px] tracking-wider uppercase font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'console'
                ? 'bg-[rgb(var(--accent-rgb)/0.15)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
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
          </button>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          title={bottomPanelCollapsed ? 'Expand bottom panel' : 'Collapse bottom panel'}
          aria-label={bottomPanelCollapsed ? 'Expand bottom panel' : 'Collapse bottom panel'}
          className="w-7 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
        >
          <Minus size={12} />
        </button>
      </div>

      {!bottomPanelCollapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {showAssetsTab && (
            <div className={activeTab === 'assets' ? 'h-full' : 'hidden'}>
              <AssetBrowserPanel />
            </div>
          )}
          <div className={activeTab === 'console' ? 'h-full' : 'hidden'}>
            <ConsolePanel />
          </div>
        </div>
      )}
    </div>
  )
}
