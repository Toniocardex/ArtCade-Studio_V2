import { lazy, Suspense, useEffect } from 'react'
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
import { useProjectLogicBoardSync } from './hooks/useProjectLogicBoardSync'
import { ProjectNamePersistProvider } from './components/menu-bar/project-name-context'
import { useViewportShortcuts } from './hooks/useViewportShortcuts'
import { useConsoleShortcut } from './hooks/useConsoleShortcut'
import { usePersistedWidth } from './hooks/usePersistedWidth'
import EditorBootGate from './components/EditorBootGate'
import { EditorViewportBanner } from './components/shell/EditorViewportBanner'
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
  const [leftW, setLeftW]   = usePersistedWidth('artcade.sidebar-left-w-v3',  280)
  const [rightW, setRightW] = usePersistedWidth('artcade.sidebar-right-w-v3', 320)

  const isEditingTileset = state.editingTilesetId != null

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <LegacyMigrateBanner />
      <div className="flex flex-1 min-h-0 overflow-hidden">

      <aside
        style={{ width: leftW }}
        className="border-r border-[var(--outline)] flex-shrink-0 overflow-hidden bg-[var(--surface)]"
      >
        <LeftSidebar />
      </aside>
      <ResizeHandle side="left" onResize={(d) => setLeftW((w) => w + d)} />

      <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--void)]">
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <div
            style={{ display: isEditingTileset ? 'none' : 'contents' }}
          >
            <PreviewPanel />
          </div>
          {isEditingTileset && (
            <Suspense fallback={null}>
              <TilesetEditorPanel />
            </Suspense>
          )}
        </div>
      </section>

      <ResizeHandle side="right" onResize={(d) => setRightW((w) => w + d)} />
      <aside
        style={{ width: rightW }}
        className="border-l border-[var(--outline)] flex-shrink-0 overflow-hidden bg-[var(--surface)]"
      >
        <InspectorPanel />
      </aside>
      </div>
    </div>
  )
}

function LogicBoardView() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--void)]">
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

function EditorLayout() {
  const { state, dispatch } = useEditor()

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
  useProjectLogicBoardSync()
  useViewportShortcuts()
  useConsoleShortcut()

  useEffect(() => {
    if (state.mode === 'script') triggerLayoutReflow()
  }, [state.mode])

  return (
    <div className="editor-shell flex flex-col w-full h-full bg-[var(--void)] text-[var(--primary)] overflow-hidden select-none">
      <MenuBar />
      <EditorViewportBanner />
      <ModuleTabs />
      <DialogEditorModal />
      <SpritesheetStudioModal />

      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        <div className="flex flex-1 min-h-0 overflow-hidden flex-col min-w-0">
          <div
            className="flex flex-1 min-h-0 overflow-hidden"
            style={{ display: state.mode === 'canvas' ? 'flex' : 'none' }}
          >
            <CanvasView />
          </div>
          {state.mode === 'logic'  && <LogicBoardView />}
          {state.mode === 'script' && <ScriptEditorView />}
        </div>

        <BottomDock />
        <StatusBar />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <EditorProvider>
      <ProjectNamePersistProvider>
        <EditorBootGate>
          <EditorLayout />
        </EditorBootGate>
      </ProjectNamePersistProvider>
    </EditorProvider>
  )
}
