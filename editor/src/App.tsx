import { lazy, Suspense, useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { EditorProvider, useEditor } from './store/editor-store'
import MenuBar            from './components/MenuBar'
import ModuleTabs from './components/shell/ModuleTabs'
import StatusBar          from './components/StatusBar'
import BottomDock        from './components/shell/BottomDock'
import LeftSidebar        from './components/LeftSidebar'
import ResizeHandle       from './components/ResizeHandle'
import PreviewPanel       from './panels/PreviewPanel'
import InspectorPanel     from './panels/InspectorPanel'
import { createBlankProject } from './utils/project'
import { starterInnkeeperScript } from './utils/dialog/dialog-file-api'
import { DialogEditorModal } from './panels/dialog/DialogEditorModal'
import { SpritesheetStudioModal } from './panels/spritesheet-studio/SpritesheetStudioModal'
import { triggerLayoutReflow } from './utils/layout-reflow'
import { useProjectShortcuts } from './hooks/useProjectShortcuts'
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
import { LayoutTierSideEffects } from './components/shell/LayoutTierSideEffects'
import type { ConsoleEntry } from './types'

const LogicBoardPanel = lazy(() => import('./panels/LogicBoardPanel'))
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
  const { state, dispatch } = useEditor()
  if (!state.legacyMigrateBanner) return null
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
  const { state } = useEditor()
  const focusMode = state.focusMode
  const tier = useLayoutTier()
  const useCompactShell = tier === 'compact' || tier === 'minimal' || tier === 'unsupported'

  const { leftW, rightW, setLeftW, setRightW, resetLeftW, resetRightW } = useEditorLayoutContext()

  const isEditingTileset = state.editingTilesetId != null

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {!focusMode && <LegacyMigrateBanner />}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {!focusMode && (
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
          {useCompactShell && <InspectorDrawer />}
          <div
            style={{ display: isEditingTileset ? 'none' : 'contents' }}
          >
            <PreviewPanel />
          </div>
          {isEditingTileset && !focusMode && (
            <Suspense fallback={null}>
              <TilesetEditorPanel />
            </Suspense>
          )}
        </div>
      </section>

      {!focusMode && !useCompactShell && (
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
    <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--logic-bg)]">
      <Suspense fallback={null}>
        <LogicBoardPanel />
      </Suspense>
    </div>
  )
}

function ScriptEditorView() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--void)]">
      <Suspense fallback={null}>
        <ScriptEditorPanel />
      </Suspense>
    </div>
  )
}

function EditorShell({ workspaceRef }: Readonly<{ workspaceRef: RefObject<HTMLDivElement | null> }>) {
  const { state } = useEditor()
  const uiScale = useEditorUiScaleContext()
  const tier = useLayoutTier()

  const shellStyle = {
    '--editor-scale': String(uiScale.scale),
  } as CSSProperties

  const motionClass = state.reduceMotion ? 'editor-reduce-motion' : ''
  const focusClass = state.focusMode ? 'editor-focus-mode' : ''

  return (
    <div
      className={`editor-shell relative flex flex-col w-full h-full bg-[var(--bg-app)] text-[var(--primary)] overflow-hidden select-none ${motionClass} ${focusClass}`}
      style={shellStyle}
      data-layout-tier={tier}
    >
      <EditorLayoutProvider>
        <LayoutTierSideEffects />
        {!state.focusMode && (
          <header className="editor-top-chrome">
            <MenuBar />
            <ModuleTabs />
          </header>
        )}
        {!state.focusMode && <EditorViewportBanner />}
        <DialogEditorModal />
        <SpritesheetStudioModal />

        <div
          ref={workspaceRef}
          className="editor-workspace flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden"
        >
          <div className="flex flex-1 min-h-0 overflow-hidden flex-col min-w-0">
            <div
              className="flex flex-1 min-h-0 overflow-hidden"
              style={{ display: state.mode === 'canvas' ? 'flex' : 'none' }}
            >
              <CanvasView />
            </div>
            {state.mode === 'logic' && <LogicBoardView />}
            {state.mode === 'script' && <ScriptEditorView />}
          </div>

          {!state.focusMode && <BottomDock />}
          <StatusBar compact={state.focusMode} />
        </div>
      </EditorLayoutProvider>
    </div>
  )
}

function EditorLayout() {
  const { state, dispatch } = useEditor()
  const workspaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.project || state.projectPath) return
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

  useEffect(() => {
    if (state.mode === 'script') triggerLayoutReflow()
  }, [state.mode])

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
