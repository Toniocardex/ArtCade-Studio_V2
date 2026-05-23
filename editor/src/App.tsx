import { useEffect, useState } from 'react'
import { EditorProvider, useEditor } from './store/editor-store'
import MenuBar            from './components/MenuBar'
import ModuleRail from './components/ModuleRail'
import StatusBar          from './components/StatusBar'
import ConsoleOverlay     from './components/ConsoleOverlay'
import ResizeHandle       from './components/ResizeHandle'
import SceneObjectsPanel from './panels/SceneObjectsPanel'
import PreviewPanel       from './panels/PreviewPanel'
import InspectorPanel     from './panels/InspectorPanel'
import LogicBoardPanel    from './panels/LogicBoardPanel'
import ScriptEditorPanel  from './panels/ScriptEditorPanel'
import AssetBrowserPanel  from './panels/AssetBrowserPanel'
import TilesetEditorPanel from './panels/TilesetEditorPanel'
import { createBlankProject } from './utils/project'
import { runtimeSync } from './utils/runtime-sync-service'
import { triggerLayoutReflow } from './utils/layout-reflow'
import { useProjectShortcuts } from './hooks/useProjectShortcuts'
import { useViewportShortcuts } from './hooks/useViewportShortcuts'
import { useConsoleShortcut } from './hooks/useConsoleShortcut'
import { usePersistedWidth } from './hooks/usePersistedWidth'
import type { ConsoleEntry } from './types'

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
// AssetsStrip — always-visible bottom panel hosting the asset browser.
// Replaces the old multi-tab BottomPanel (Assets/Tileset/Console were tabs).
// The Console now lives in an overlay; the Tileset Editor opens in place of
// the canvas viewport when triggered from AssetBrowser.
// ---------------------------------------------------------------------------

function AssetsStrip() {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div
      className="border-t border-[var(--border)] bg-[var(--panel)] flex flex-col flex-shrink-0
                 transition-[height] duration-100"
      style={{ height: collapsed ? 28 : 256 }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="px-3 h-7 flex items-center gap-2 border-b border-[var(--border)]
                   text-[10px] tracking-wider uppercase text-[var(--muted)] font-semibold
                   hover:text-[var(--text)] transition-colors flex-shrink-0 text-left"
        title={collapsed ? 'Expand Assets' : 'Collapse Assets'}
        aria-expanded={!collapsed}
      >
        <span className="inline-block w-2 text-[var(--muted)]">
          {collapsed ? '▶' : '▼'}
        </span>
        Assets
      </button>
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <AssetBrowserPanel />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CANVAS mode layout: scene objects | viewport (or tileset editor) | inspector
// Sidebars are user-resizable; widths persist in localStorage.
// ---------------------------------------------------------------------------

function CanvasView() {
  const { state } = useEditor()
  const [leftW, setLeftW]   = usePersistedWidth('artcade.sidebar-left-w',  256)
  const [rightW, setRightW] = usePersistedWidth('artcade.sidebar-right-w', 320)

  const isEditingTileset = state.editingTilesetId != null

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Left sidebar — Scenes + Objects */}
      <aside
        style={{ width: leftW }}
        className="border-r border-[var(--border)] flex-shrink-0 overflow-hidden bg-[var(--panel)]"
      >
        <SceneObjectsPanel />
      </aside>
      <ResizeHandle side="left" onResize={(d) => setLeftW((w) => w + d)} />

      {/* Center — Viewport (or TilesetEditor) + Assets strip stacked */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg)]">
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {/* WASM canvas stays MOUNTED (Emscripten lifetime). Hide it via
              display:'none' when the tileset editor takes over the viewport. */}
          <div
            style={{ display: isEditingTileset ? 'none' : 'contents' }}
          >
            <PreviewPanel />
          </div>
          {isEditingTileset && <TilesetEditorPanel />}
        </div>
        <AssetsStrip />
      </section>

      {/* Right sidebar — Inspector */}
      <ResizeHandle side="right" onResize={(d) => setRightW((w) => w + d)} />
      <aside
        style={{ width: rightW }}
        className="border-l border-[var(--border)] flex-shrink-0 overflow-hidden bg-[var(--panel)]"
      >
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
  useConsoleShortcut()

  // Script editor mounts only in script mode — reflow after Tauri show / tab switch.
  useEffect(() => {
    if (state.mode === 'script') triggerLayoutReflow()
  }, [state.mode])

  return (
    <div className="editor-shell flex flex-col w-full h-full bg-[var(--bg)] text-[var(--text)] overflow-hidden select-none">
      <MenuBar />

      <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
        <ModuleRail />

        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden relative">
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

        {/* Console overlay — Ctrl+` toggles; mounted once at this level so it
            floats over any mode. */}
        <ConsoleOverlay
          open={state.consoleOpen}
          onClose={() => dispatch({ type: 'SET_CONSOLE_OPEN', open: false })}
        />

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
