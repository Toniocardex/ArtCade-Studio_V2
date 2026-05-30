import { useEffect, useMemo, useState } from 'react'
import { Minus } from 'lucide-react'
import { useEditor, useConsoleLogs } from '../../store/editor-store'
import { usePersistedHeight } from '../../hooks/usePersistedHeight'
import { useBuildLogListener } from '../../hooks/useBuildLogListener'
import { triggerLayoutReflow } from '../../utils/layout-reflow'
import { logicBoardLabel } from '../../utils/project'
import VerticalResizeHandle from '../VerticalResizeHandle'
import ConsolePanel from '../../panels/ConsolePanel'
import { EditorTab } from '../ui/EditorTab'
import { LogicBoardPreviewTab } from './dock/LogicBoardPreviewTab'
import { DockPlaceholderTab } from './dock/DockPlaceholderTab'
import { AnimationTimelineTab } from './dock/AnimationTimelineTab'

const HANDLE_H = 4
const HEADER_H = 28
const DEFAULT_HEIGHT = 300
const MIN_CONTENT_H = 160
const MIN_TOTAL_H = HANDLE_H + HEADER_H + MIN_CONTENT_H
const LEGACY_HEIGHT_CEILING = 220

type DockTab = 'console' | 'timeline' | 'logicPreview' | 'eventDebugger'

function maxDockHeight(): number {
  if (globalThis.window === undefined) return 480
  return Math.max(MIN_TOTAL_H, Math.round(globalThis.innerHeight * 0.38))
}

function clampDockHeight(n: number): number {
  return Math.max(MIN_TOTAL_H, Math.min(maxDockHeight(), Math.round(n)))
}

function readInitialHeight(): number {
  if (globalThis.window === undefined) return DEFAULT_HEIGHT
  const v5 = globalThis.localStorage.getItem('artcade.bottom-dock-h-v5')
  if (v5) {
    const n = Number(v5)
    if (Number.isFinite(n)) return clampDockHeight(n)
  }
  const v4 = globalThis.localStorage.getItem('artcade.console-dock-h-v4')
  if (v4) {
    const n = Number(v4)
    if (Number.isFinite(n)) return clampDockHeight(n < LEGACY_HEIGHT_CEILING ? DEFAULT_HEIGHT : n)
  }
  return DEFAULT_HEIGHT
}

export default function BottomDock() {
  const { state, dispatch } = useEditor()
  const { state: volatile } = useConsoleLogs()
  const { bottomPanelCollapsed, consoleAckUpToId, mode, project, selection } = state
  const [dockTab, setDockTab] = useState<DockTab>('console')

  useBuildLogListener()

  const [maxH, setMaxH] = useState(maxDockHeight)
  const [height, setHeight] = usePersistedHeight(
    'artcade.bottom-dock-h-v5',
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

  const consoleVisible = !bottomPanelCollapsed && dockTab === 'console'

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

  const rulesheetSuffix = useMemo(() => {
    if (mode !== 'logic' || !project) return ''
    const board = project.logicBoards?.find((b) =>
      selection.entityId != null
        ? b.target.type === 'entity_id' && b.target.entityId === selection.entityId
        : false,
    )
    if (!board) return ''
    return ` — ${logicBoardLabel(project, board)}`
  }, [mode, project, selection.entityId])

  const tabs: ReadonlyArray<{ id: DockTab; label: string }> = [
    { id: 'console', label: `Debug Console${rulesheetSuffix}` },
    { id: 'timeline', label: 'Animation Timeline' },
    { id: 'logicPreview', label: 'Logic Board Preview' },
    { id: 'eventDebugger', label: 'Event Debugger' },
  ]

  return (
    <div
      className="flex flex-col flex-shrink-0 border-t border-[var(--outline)] bg-[var(--surface)]
                 transition-[height] duration-100"
      style={{ height: panelHeight }}
      data-panel="bottom-dock"
    >
      {!bottomPanelCollapsed && (
        <VerticalResizeHandle onResize={(d) => setHeight((h) => h + d)} />
      )}

      <div className="shrink-0 flex items-center border-b border-[var(--outline)] min-h-7">
        <div className="flex-1 flex items-center gap-0 overflow-x-auto px-1">
          {tabs.map(({ id, label }) => (
            <EditorTab
              key={id}
              active={dockTab === id}
              onClick={() => setDockTab(id)}
              className="!py-1.5 !px-2 text-[9px] whitespace-nowrap"
            >
              {label}
            </EditorTab>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'SET_BOTTOM_PANEL_COLLAPSED',
              collapsed: !bottomPanelCollapsed,
            })
          }
          title={bottomPanelCollapsed ? 'Expand bottom dock' : 'Collapse bottom dock'}
          aria-label={bottomPanelCollapsed ? 'Expand bottom dock' : 'Collapse bottom dock'}
          className="w-8 h-7 flex items-center justify-center text-[var(--muted)] hover:text-[var(--primary)] shrink-0"
        >
          <Minus size={12} />
          {issueCount > 0 && dockTab !== 'console' ? (
            <span className="sr-only">{issueCount} console issues</span>
          ) : null}
        </button>
      </div>

      {!bottomPanelCollapsed && (
        <div className="flex-1 min-h-0 overflow-hidden bg-[var(--void)]">
          {dockTab === 'console' && <ConsolePanel />}
          {dockTab === 'timeline' && <AnimationTimelineTab />}
          {dockTab === 'logicPreview' && <LogicBoardPreviewTab />}
          {dockTab === 'eventDebugger' && (
            <DockPlaceholderTab title="Event Debugger" message="Live event debugging requires runtime integration (deferred)." />
          )}
        </div>
      )}
    </div>
  )
}
