import { useEffect }       from 'react'
import { EditorProvider, useEditor } from './store/editor-store'
import MenuBar            from './components/MenuBar'
import ModuleRail from './components/ModuleRail'
import StatusBar          from './components/StatusBar'
import SceneObjectsPanel from './panels/SceneObjectsPanel'
import PreviewPanel       from './panels/PreviewPanel'
import InspectorPanel     from './panels/InspectorPanel'
import LogicBoardPanel    from './panels/LogicBoardPanel'
import ScriptEditorPanel  from './panels/ScriptEditorPanel'
import AssetBrowserPanel  from './panels/AssetBrowserPanel'
import TilesetEditorPanel from './panels/TilesetEditorPanel'
import ConsolePanel       from './panels/ConsolePanel'
import { createBlankProject } from './utils/project'
import { runtimeSync } from './utils/runtime-sync-service'
import { triggerLayoutReflow } from './utils/layout-reflow'
import { useProjectShortcuts } from './hooks/useProjectShortcuts'
import { useViewportShortcuts } from './hooks/useViewportShortcuts'
import type { BottomTab, ConsoleEntry } from './types'

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

// ---------------------------------------------------------------------------
// Bottom tab bar (ASSETS / TILESET_EDITOR / CONSOLE)
// ---------------------------------------------------------------------------

interface BottomTabConfig {
  id:    BottomTab
  label: string
}

const BOTTOM_TABS: BottomTabConfig[] = [
  { id: 'assets',  label: 'ASSETS'         },
  { id: 'tileset', label: 'TILESET_EDITOR' },
  { id: 'console', label: 'CONSOLE'        },
]

function BottomPanel() {
  const { state, dispatch } = useEditor()
  const { bottomTab } = state

  return (
    <div className="h-64 border-t border-[var(--border)] bg-[var(--panel)] flex flex-col flex-shrink-0">
      {/* Tab bar — active state uses navy underline (style guide: secondary accent for selections) */}
      <div className="flex border-b border-[var(--border)] px-2 flex-shrink-0">
        {BOTTOM_TABS.map(tab => {
          const active = bottomTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_BOTTOM_TAB', tab: tab.id })}
              className={`px-4 py-2 text-[10px] font-semibold tracking-wider transition-colors whitespace-nowrap border-b-2 ${
                active
                  ? 'border-[var(--accent-2)] text-[var(--text)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {bottomTab === 'assets'  && <AssetBrowserPanel />}
        {bottomTab === 'tileset' && <TilesetEditorPanel />}
        {bottomTab === 'console' && <ConsolePanel />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CANVAS mode layout: scene objects | viewport+bottom | inspector
// ---------------------------------------------------------------------------

function CanvasView() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Left sidebar — Scenes + Objects */}
      <aside className="w-64 border-r border-[var(--border)] flex-shrink-0 overflow-hidden bg-[var(--panel)]">
        <SceneObjectsPanel />
      </aside>

      {/* Center — Viewport + bottom panel stacked */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg)]">
        <div className="flex-1 min-h-0 overflow-hidden">
          <PreviewPanel />
        </div>
        <BottomPanel />
      </section>

      {/* Right sidebar — Inspector */}
      <aside className="w-80 border-l border-[var(--border)] flex-shrink-0 overflow-hidden bg-[var(--panel)]">
        <InspectorPanel />
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LOGIC_BOARD mode
// ---------------------------------------------------------------------------

function LogicBoardView() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <LogicBoardPanel />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SCRIPT mode: full-screen Lua editor
// ---------------------------------------------------------------------------

function ScriptEditorView() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <ScriptEditorPanel />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

function EditorLayout() {
  const { state, dispatch } = useEditor()

  // ── First boot: load an in-memory blank project so the editor opens to the
  // same clean state produced by File → New Project (1 empty Main Scene, no
  // entities, no scripts). path='' marks it as unsaved.
  useEffect(() => {
    if (state.project || state.projectPath) return
    const blank = createBlankProject('Untitled')
    runtimeSync.reset()
    dispatch({ type: 'LOAD_PROJECT', project: blank, path: '' })
    dispatch({ type: 'LOG', entry: bootLog('OK new blank project (unsaved – use Save Project As to persist).', 'info') })
    // Run once at mount; further "new project" actions go through the menu/shortcut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Global shortcuts are split by concern so each hook only re-binds when its
  // own state changes (TECHNICAL_DEBT_REVIEW §16).
  useProjectShortcuts()
  useViewportShortcuts()

  // Script editor mounts only in script mode — reflow after Tauri show / tab switch.
  useEffect(() => {
    if (state.mode === 'script') triggerLayoutReflow()
  }, [state.mode])

  return (
    <div className="editor-shell flex flex-col w-full h-full bg-[var(--bg)] text-[var(--text)] overflow-hidden select-none">
      <MenuBar />

      <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
        <ModuleRail />

        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {/* Only CanvasView must stay MOUNTED: unmounting it would detach the
            WASM canvas while Emscripten keeps rendering into the removed node
            → empty viewport on return. It is kept alive via display toggling
            (`contents` when active, `none` when hidden).

            LogicBoardView / ScriptEditorView have NO WASM canvas, so they are
            mounted CONDITIONALLY. Script editor needs a real sized flex box
            (not `display:contents`), so it mounts only when active. */}
        <div style={{ display: state.mode === 'canvas' ? 'contents' : 'none' }}>
          <CanvasView />
        </div>
        {state.mode === 'logic'  && <LogicBoardView />}
        {state.mode === 'script' && <ScriptEditorView />}

        <StatusBar />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <EditorProvider>
      <EditorLayout />
    </EditorProvider>
  )
}
