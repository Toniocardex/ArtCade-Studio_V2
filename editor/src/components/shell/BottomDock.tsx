// ---------------------------------------------------------------------------
// BottomDock — debug drawer overlaying the central canvas column.
//
// Lives inside the center column (between the sidebars), absolutely anchored
// to the bottom so opening/closing NEVER resizes the WASM canvas or the side
// panels (see docs UI charter §2.3). Collapsed state renders nothing — the
// StatusBar below acts as the collapsed 24px strip and hosts the expand
// toggle.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { Minus } from 'lucide-react'
import { useEditorDispatch, useEditorSelector, useConsoleLogs } from '../../store/editor-store'
import { useEditorLayoutContext } from '../../contexts/editor-layout-context'
import VerticalResizeHandle from '../VerticalResizeHandle'
import { DockPanelChrome } from './dock/DockPanelChrome'
import { DOCK_PANEL_REGISTRY } from './dock/dock-panel-registry'
import { DOCK_PANEL_ORDER } from '../../constants/dock-panels'
import { CANVAS_MIN_HEIGHT, DOCK_HEIGHT_MIN } from '../../constants/editor-layout-persist'
import { EDITOR_DOCK_H_DEFAULT, EDITOR_TOP_CHROME_H_PX } from '../../constants/editor-layout'

const STATUS_H = 24

function maxDockHeight(): number {
  if (globalThis.window === undefined) return 480
  const viewportCap = Math.round(globalThis.innerHeight * 0.6)
  const canvasReserveCap = globalThis.innerHeight - EDITOR_TOP_CHROME_H_PX - STATUS_H - CANVAS_MIN_HEIGHT
  return Math.max(DOCK_HEIGHT_MIN, Math.min(viewportCap, canvasReserveCap))
}

function clampDockHeight(n: number): number {
  return Math.max(DOCK_HEIGHT_MIN, Math.min(maxDockHeight(), Math.round(n)))
}

export default function BottomDock() {
  const dispatch = useEditorDispatch()
  const bottomPanelCollapsed = useEditorSelector((s) => s.bottomPanelCollapsed)
  const consoleAckUpToId = useEditorSelector((s) => s.consoleAckUpToId)
  const dockPanelVisibility = useEditorSelector((s) => s.dockPanelVisibility)
  const { state: volatile } = useConsoleLogs()

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
  const dockExpanded = !bottomPanelCollapsed

  useEffect(() => {
    function onResize() {
      setMaxH(maxDockHeight())
    }
    globalThis.addEventListener('resize', onResize)
    return () => globalThis.removeEventListener('resize', onResize)
  }, [])

  const setDockH = layout.setDockH
  useEffect(() => {
    setDockH((h) => clampDockHeight(Math.min(h, maxH)))
  }, [maxH, setDockH])

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

  if (bottomPanelCollapsed) return null

  const gridStyle =
    visibleCount > 0
      ? { gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }
      : undefined

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col
                 border-t border-[var(--outline-strong)] bg-[var(--bg-window)] shadow-none"
      style={{ height }}
      data-panel="bottom-dock"
      data-visible-panels={visibleCount}
    >
      <VerticalResizeHandle
        onResize={(d) => setHeight((h) => clampDockHeight(h + d))}
        onReset={() => setHeight(EDITOR_DOCK_H_DEFAULT)}
      />

      <div className="shrink-0 flex items-center border-b border-[var(--outline)] min-h-7 px-2 bg-[var(--surface-2)]">
        <span className="flex-1 text-[8px] font-bold uppercase tracking-widest text-[var(--muted)]">
          Bottom panels
          {visibleCount > 0 && visibleCount < DOCK_PANEL_ORDER.length ? ` / ${visibleCount}` : ''}
        </span>
        {issueCount > 0 && (
          <span className="text-[9px] font-mono text-[var(--warn)] mr-2">
            {issueCount} issue{issueCount === 1 ? '' : 's'}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            layout.setDockCollapsed(true)
            dispatch({ type: 'SET_BOTTOM_PANEL_COLLAPSED', collapsed: true })
          }}
          title="Collapse bottom dock"
          aria-label="Collapse bottom dock"
          className="w-8 h-7 flex items-center justify-center text-[var(--muted)] hover:text-[var(--primary)] shrink-0"
        >
          <Minus size={12} />
        </button>
      </div>

      <div className="flex-1 min-h-0 grid editor-dock-body" style={gridStyle}>
        {visibleCount === 0 ? (
          <p className="col-span-full flex items-center justify-center text-[10px] text-[var(--muted)] px-4">
            No panels visible - enable panels in View / Bottom panels
          </p>
        ) : (
          visiblePanels.map((panel) => (
            <DockPanelChrome key={panel.id} title={panel.title}>
              {panel.render()}
            </DockPanelChrome>
          ))
        )}
      </div>
    </div>
  )
}
