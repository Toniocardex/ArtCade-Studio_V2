import { useEffect, useMemo, useState } from 'react'
import { Minus } from 'lucide-react'
import { useEditor, useConsoleLogs } from '../../store/editor-store'
import { useEditorLayoutContext } from '../../contexts/editor-layout-context'
import { useBuildLogListener } from '../../hooks/useBuildLogListener'
import { triggerLayoutReflow } from '../../utils/layout-reflow'
import VerticalResizeHandle from '../VerticalResizeHandle'
import { DockPanelChrome } from './dock/DockPanelChrome'
import { DOCK_PANEL_REGISTRY } from './dock/dock-panel-registry'
import { DOCK_PANEL_ORDER } from '../../constants/dock-panels'

const HANDLE_H = 4
const HEADER_H = 28
const MIN_CONTENT_H = 160
const MIN_TOTAL_H = HANDLE_H + HEADER_H + MIN_CONTENT_H
function maxDockHeight(): number {
  if (globalThis.window === undefined) return 480
  const cap = Math.min(320, Math.round(globalThis.innerHeight * 0.32))
  return Math.max(MIN_TOTAL_H, cap)
}

function clampDockHeight(n: number): number {
  return Math.max(MIN_TOTAL_H, Math.min(maxDockHeight(), Math.round(n)))
}

export default function BottomDock() {
  const { state, dispatch } = useEditor()
  const { state: volatile } = useConsoleLogs()
  const { bottomPanelCollapsed, consoleAckUpToId, dockPanelVisibility } = state

  useBuildLogListener()

  const [maxH, setMaxH] = useState(maxDockHeight)
  const layout = useEditorLayoutContext()
  const height = clampDockHeight(layout.dockH)
  const setHeight = (next: number | ((prev: number) => number)) => {
    layout.setDockH((h) => {
      const raw = typeof next === 'function' ? next(h) : next
      return clampDockHeight(raw)
    })
  }

  const visiblePanels = useMemo(
    () => DOCK_PANEL_REGISTRY.filter((p) => dockPanelVisibility[p.id]),
    [dockPanelVisibility],
  )
  const visibleCount = visiblePanels.length
  const consoleVisible = dockPanelVisibility.console

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
  }, [height, bottomPanelCollapsed, dockPanelVisibility])

  const dockExpanded = !bottomPanelCollapsed

  useEffect(() => {
    if (!dockExpanded || !consoleVisible || !volatile.consoleLogs.length) return
    const maxId = Math.max(...volatile.consoleLogs.map((e) => e.id))
    dispatch({ type: 'ACKNOWLEDGE_CONSOLE_LOGS', upToId: maxId })
  }, [dockExpanded, consoleVisible, volatile.consoleLogs, dispatch])

  const issueCount = useMemo(() => {
    if (!dockExpanded || !consoleVisible) return 0
    return volatile.consoleLogs.filter(
      (e) => (e.level === 'warn' || e.level === 'error') && e.id > consoleAckUpToId,
    ).length
  }, [volatile.consoleLogs, dockExpanded, consoleVisible, consoleAckUpToId])

  const panelHeight = bottomPanelCollapsed ? HEADER_H : height

  const gridStyle =
    visibleCount > 0
      ? { gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }
      : undefined

  return (
    <div
      className="flex flex-col flex-shrink-0 border-t border-[var(--outline-strong)] bg-[var(--bg-window)]
                 transition-[height] duration-100"
      style={{ height: panelHeight }}
      data-panel="bottom-dock"
      data-visible-panels={visibleCount}
    >
      {!bottomPanelCollapsed && (
        <VerticalResizeHandle onResize={(d) => setHeight((h) => clampDockHeight(h + d))} />
      )}

      <div className="shrink-0 flex items-center border-b border-[var(--outline)] min-h-7 px-2 bg-[var(--surface-2)]">
        <span className="flex-1 text-[8px] font-bold uppercase tracking-widest text-[var(--muted)]">
          Bottom panels
          {visibleCount > 0 && visibleCount < DOCK_PANEL_ORDER.length
            ? ` · ${visibleCount}`
            : ''}
        </span>
        {issueCount > 0 && (
          <span className="text-[9px] font-mono text-[var(--warn)] mr-2">
            {issueCount} issue{issueCount === 1 ? '' : 's'}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            const collapsed = !bottomPanelCollapsed
            layout.setDockCollapsed(collapsed)
            dispatch({
              type: 'SET_BOTTOM_PANEL_COLLAPSED',
              collapsed,
            })
          }}
          title={bottomPanelCollapsed ? 'Expand bottom dock' : 'Collapse bottom dock'}
          aria-label={bottomPanelCollapsed ? 'Expand bottom dock' : 'Collapse bottom dock'}
          className="w-8 h-7 flex items-center justify-center text-[var(--muted)] hover:text-[var(--primary)] shrink-0"
        >
          <Minus size={12} />
        </button>
      </div>

      {dockExpanded && (
        <div className="flex-1 min-h-0 grid editor-dock-body" style={gridStyle}>
          {visibleCount === 0 ? (
            <p className="col-span-full flex items-center justify-center text-[10px] text-[var(--muted)] px-4">
              No panels visible — enable panels in View → Bottom panels
            </p>
          ) : (
            visiblePanels.map((panel) => (
              <DockPanelChrome key={panel.id} title={panel.title}>
                {panel.render()}
              </DockPanelChrome>
            ))
          )}
        </div>
      )}
    </div>
  )
}
