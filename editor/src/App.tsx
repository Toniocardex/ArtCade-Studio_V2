import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { EditorProvider, useEditorDispatch, useEditorSelector, useEditorStore } from './store/editor-store'
import MenuBar            from './components/MenuBar'
import StatusBar          from './components/StatusBar'
import BottomDock        from './components/shell/BottomDock'
import LeftSidebar        from './components/LeftSidebar'
import ResizeHandle       from './components/ResizeHandle'
import PreviewPanel       from './panels/PreviewPanel'
import InspectorPanel     from './panels/InspectorPanel'
import LogicBoardPanel    from './panels/LogicBoardPanel'
import { createBlankProject } from './utils/project'
import { starterInnkeeperScript } from './utils/dialog/dialog-file-api'
import { DialogEditorModal } from './panels/dialog/DialogEditorModal'
import { SpritesheetStudioModal } from './panels/spritesheet-studio/SpritesheetStudioModal'
import { triggerLayoutReflow } from './utils/layout-reflow'
import { useProjectShortcuts } from './hooks/useProjectShortcuts'
import { useBuildLogListener } from './hooks/useBuildLogListener'
import { useEditorUndoRedo } from './hooks/useEditorUndoRedo'
import { useProjectLogicBoardSync } from './hooks/useProjectLogicBoardSync'
import { ProjectNamePersistProvider } from './components/menu-bar/project-name-context'
import { useViewportShortcuts } from './hooks/useViewportShortcuts'
import { useConsoleShortcut } from './hooks/useConsoleShortcut'
import { useFocusModeShortcut, useExitFocusOnEscape } from './hooks/useFocusModeShortcut'
import { useEditorLayoutContext, EditorLayoutProvider } from './contexts/editor-layout-context'
import EditorBootGate from './components/EditorBootGate'
import { EditorViewportBanner } from './components/shell/EditorViewportBanner'
import { EditorUiScaleProvider, useEditorUiScaleContext } from './contexts/editor-ui-scale-context'
import { EditorLayoutTierProvider, useLayoutTier } from './contexts/editor-layout-tier-context'
import CompactLeftSidebar from './components/shell/CompactLeftSidebar'
import { InspectorDrawer } from './components/shell/InspectorDrawer'
import { InspectorDrawerProvider } from './contexts/inspector-drawer-context'
import { LayoutTierSideEffects } from './components/shell/LayoutTierSideEffects'
import { EditorUiScaleSuggestionBanner } from './components/shell/EditorUiScaleSuggestionBanner'
import { CanvasToolRail } from './components/shell/CanvasToolRail'
import type { EditorTool } from './utils/runtime-sync-service'
import type { ConsoleEntry } from './types'

const ScriptEditorPanel = lazy(() => import('./panels/ScriptEditorPanel'))
const TilesetEditorPanel = lazy(() => import('./panels/TilesetEditorPanel'))

let _bootLogId = 500
function bootLog(message: string, level: ConsoleEntry['level']): ConsoleEntry {
  const now = new Date()
  return {
    id:      ++_bootLogId,
    time:    now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    message,
    level,
  }
}

function LegacyMigrateBanner() {
  const dispatch = useEditorDispatch()
  const legacyMigrateBanner = useEditorSelector((s) => s.legacyMigrateBanner)
  if (!legacyMigrateBanner) return null
  return (
    <div className="shrink-0 px-3 py-1.5 bg-[var(--accent-muted)] border-b border-[var(--outline)]
                    text-[11px] text-[var(--primary)] flex items-center justify-between gap-2">
      <span>
        Project upgraded to Object Types (format v2). Save to keep the new layout on disk.
      </span>
      <button
        type="button"
        className="text-[10px] font-semibold text-[var(--accent)] hover:underline"
        onClick={() => dispatch({ type: 'DISMISS_LEGACY_MIGRATE_BANNER' })}
      >
        Dismiss
      </button>
    </div>
  )
}

function CanvasView() {
  const focusMode = useEditorSelector((s) => s.focusMode)
  const mode = useEditorSelector((s) => s.mode)
  const editingTilesetId = useEditorSelector((s) => s.editingTilesetId)
  const tier = useLayoutTier()
  const useCompactShell = tier === 'compact' || tier === 'minimal' || tier === 'unsupported'
  const showLeftRail = !focusMode && (tier === 'full' || tier === 'compact')
  const showFullSidebars = !focusMode && tier === 'full'
  const showToolRail = showLeftRail && mode === 'canvas'

  const { leftW, rightW, setLeftW, setRightW, resetLeftW, resetRightW } = useEditorLayoutContext()
  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [showEditorGuides, setShowEditorGuides] = useState(true)

  const isEditingTileset = editingTilesetId != null

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {!focusMode && <LegacyMigrateBanner />}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {showToolRail && (
        <CanvasToolRail
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          showGuides={showEditorGuides}
          onToggleGuides={() => setShowEditorGuides((v) => !v)}
        />
      )}

      {showLeftRail && (
        <>
          <aside
            style={{ width: leftW }}
            className="editor-chrome-panel border-r border-[var(--outline)] flex-shrink-0 overflow-hidden bg-[var(--surface)]"
          >
            {useCompactShell ? <CompactLeftSidebar /> : <LeftSidebar />}
          </aside>
          <ResizeHandle
            side="left"
            onResize={(d) => setLeftW((w) => w + d)}
            onReset={resetLeftW}
          />
        </>
      )}

      <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--void)] relative">
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {useCompactShell ? (
            <InspectorDrawerProvider>
              <InspectorDrawer />
              <div style={{ display: isEditingTileset ? 'none' : 'contents' }}>
                <PreviewPanel
                  activeTool={activeTool}
                  onSelectTool={setActiveTool}
                  showEditorGuides={showEditorGuides}
                  onToggleGuides={() => setShowEditorGuides((v) => !v)}
                  showToolPalette={!showToolRail}
                />
              </div>
            </InspectorDrawerProvider>
          ) : (
          <div
            style={{ display: isEditingTileset ? 'none' : 'contents' }}
          >
            <PreviewPanel
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              showEditorGuides={showEditorGuides}
              onToggleGuides={() => setShowEditorGuides((v) => !v)}
              showToolPalette={!showToolRail}
            />
          </div>
          )}
          {isEditingTileset && !focusMode && (
            <Suspense fallback={null}>
              <TilesetEditorPanel />
            </Suspense>
          )}
          {!focusMode && <BottomDock />}
        </div>
        <StatusBar compact={focusMode} />
      </section>

      {showFullSidebars && (
        <>
          <ResizeHandle
            side="right"
            onResize={(d) => setRightW((w) => w + d)}
            onReset={resetRightW}
          />
          <aside
            style={{ width: rightW }}
            className="editor-chrome-panel border-l border-[var(--outline)] flex-shrink-0 overflow-hidden bg-[var(--surface)]"
          >
            <InspectorPanel />
          </aside>
        </>
      )}
      </div>
    </div>
  )
}

function LogicBoardView() {
  return (
    <div className="flex flex-1 flex-col min-h-0 min-w-0 w-full overflow-hidden bg-[var(--logic-bg)]">
      <div className="relative flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
        <LogicBoardPanel />
        <BottomDock />
      </div>
      <StatusBar />
    </div>
  )
}

function ScriptEditorView() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden bg-[var(--void)]">
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={null}>
          <ScriptEditorPanel />
        </Suspense>
        <BottomDock />
      </div>
      <StatusBar />
    </div>
  )
}

function EditorShell({ workspaceRef }: Readonly<{ workspaceRef: RefObject<HTMLDivElement | null> }>) {
  const reduceMotion = useEditorSelector((s) => s.reduceMotion)
  const focusMode = useEditorSelector((s) => s.focusMode)
  const mode = useEditorSelector((s) => s.mode)
  const uiScale = useEditorUiScaleContext()
  const tier = useLayoutTier()

  const shellStyle = {
    '--editor-scale': String(uiScale.scale),
  } as CSSProperties

  const motionClass = reduceMotion ? 'editor-reduce-motion' : ''
  const focusClass = focusMode ? 'editor-focus-mode' : ''

  return (
    <div
      className={`editor-shell relative flex flex-col w-full h-full bg-[var(--bg-app)] text-[var(--primary)] overflow-hidden select-none ${motionClass} ${focusClass}`}
      style={shellStyle}
      data-layout-tier={tier}
    >
      <EditorLayoutProvider>
        <LayoutTierSideEffects />
        {!focusMode && (
          <header className="editor-top-chrome">
            <MenuBar />
          </header>
        )}
        {!focusMode && <EditorViewportBanner />}
        {!focusMode && <EditorUiScaleSuggestionBanner />}
        <DialogEditorModal />
        <SpritesheetStudioModal />

        <div
          ref={workspaceRef}
          className="editor-workspace flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden"
        >
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            {mode === 'canvas' && <CanvasView />}
            {mode === 'logic' && <LogicBoardView />}
            {mode === 'script' && <ScriptEditorView />}
          </div>
        </div>
      </EditorLayoutProvider>
    </div>
  )
}

function EditorLayout() {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const mode = useEditorSelector((s) => s.mode)
  const workspaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { project, projectPath } = store.getState()
    if (project || projectPath) return
    const blank = createBlankProject('Untitled')
    const starter = { innkeeper: starterInnkeeperScript() }
    dispatch({
      type: 'LOAD_PROJECT',
      project: blank,
      path: '',
      dialogs: starter,
      selectedDialogId: 'innkeeper',
    })
    dispatch({ type: 'LOG', entry: bootLog('OK new blank project (unsaved – use Save Project As to persist).', 'info') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useProjectShortcuts()
  useEditorUndoRedo()
  useProjectLogicBoardSync()
  useViewportShortcuts()
  useConsoleShortcut()
  useFocusModeShortcut()
  useExitFocusOnEscape()
  // Build logs must survive view switches — BottomDock remounts per view,
  // so the listener lives here (always mounted).
  useBuildLogListener()

  useEffect(() => {
    if (mode === 'script') triggerLayoutReflow()
  }, [mode])

  return (
    <EditorLayoutTierProvider workspaceRef={workspaceRef}>
      <EditorShell workspaceRef={workspaceRef} />
    </EditorLayoutTierProvider>
  )
}

export default function App() {
  return (
    <EditorProvider>
      <ProjectNamePersistProvider>
        <EditorUiScaleProvider>
          <EditorBootGate>
            <EditorLayout />
          </EditorBootGate>
        </EditorUiScaleProvider>
      </ProjectNamePersistProvider>
    </EditorProvider>
  )
}
