import { useEffect }       from 'react'
import { EditorProvider, useEditor } from './store/editor-store'
import MenuBar            from './components/MenuBar'
import ModuleRail         from './components/ModuleRail'
import StatusBar          from './components/StatusBar'
import HierarchyPanel     from './panels/HierarchyPanel'
import PreviewPanel       from './panels/PreviewPanel'
import InspectorPanel     from './panels/InspectorPanel'
import LogicBoardPanel    from './panels/LogicBoardPanel'
import ScriptEditorPanel  from './panels/ScriptEditorPanel'
import AssetBrowserPanel  from './panels/AssetBrowserPanel'
import TilesetEditorPanel from './panels/TilesetEditorPanel'
import ConsolePanel       from './panels/ConsolePanel'
import { openProjectDialog, loadProjectFile, saveProjectFile, saveScript } from './utils/api'
import type { BottomTab, ConsoleEntry } from './types'

let _kbdLogId = 500
function kbdLog(message: string, level: ConsoleEntry['level']): ConsoleEntry {
  const now = new Date()
  return {
    id:      ++_kbdLogId,
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
  color: string
}

const BOTTOM_TABS: BottomTabConfig[] = [
  { id: 'assets',  label: 'ASSETS',        color: 'var(--accent)' },
  { id: 'tileset', label: 'TILESET_EDITOR', color: 'var(--accent-2)' },
  { id: 'console', label: 'CONSOLE',       color: 'var(--text)' },
]

function BottomPanel() {
  const { state, dispatch } = useEditor()
  const { bottomTab } = state

  return (
    <div className="h-64 border-t border-[var(--border)] bg-[var(--panel)] flex flex-col flex-shrink-0">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)] px-2 flex-shrink-0">
        {BOTTOM_TABS.map(tab => {
          const active = bottomTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_BOTTOM_TAB', tab: tab.id })}
              className={`px-4 py-2 text-[10px] font-bold transition-all whitespace-nowrap ${
                active
                  ? 'border-b-2'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              style={active ? { color: tab.color, borderColor: tab.color } : {}}
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
// CANVAS mode layout: hierarchy | viewport+bottom | inspector
// ---------------------------------------------------------------------------

function CanvasView() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Left sidebar — Hierarchy */}
      <aside className="w-64 border-r border-[var(--border)] flex-shrink-0 overflow-hidden bg-[var(--panel)]">
        <HierarchyPanel />
      </aside>

      {/* Center — Viewport + bottom panel stacked */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg)]">
        <div className="flex-1 min-h-0 overflow-hidden">
          <PreviewPanel />
        </div>
        <BottomPanel />
      </section>

      {/* Right sidebar — Inspector */}
      <aside className="w-72 border-l border-[var(--border)] flex-shrink-0 overflow-hidden bg-[var(--panel)]">
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

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey) return

      // Ctrl+S — save active script
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        if (state.mode === 'canvas') {
          if (!state.project || !state.projectPath) return
          try {
            await saveProjectFile(state.projectPath, state.project)
            dispatch({ type: 'MARK_PROJECT_SAVED' })
            dispatch({ type: 'LOG', entry: kbdLog(`Saved project "${state.project.projectName}"`, 'info') })
          } catch (err) {
            dispatch({ type: 'LOG', entry: kbdLog(`Save project failed: ${err}`, 'error') })
          }
          return
        }

        const script = state.openScripts.find(s => s.path === state.activeScriptPath)
        if (!script) return
        if (!script.isDirty) {
          dispatch({ type: 'LOG', entry: kbdLog(`"${script.path}" already saved.`, 'info') })
          return
        }
        try {
          await saveScript(script.path, script.content)
          dispatch({ type: 'MARK_SCRIPT_SAVED', path: script.path })
          dispatch({ type: 'LOG', entry: kbdLog(`✓ Saved "${script.path}"`, 'info') })
        } catch (err) {
          dispatch({ type: 'LOG', entry: kbdLog(`✗ Save failed: ${err}`, 'error') })
        }
      }

      // Ctrl+O — open project
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        const path = await openProjectDialog()
        if (!path) return
        dispatch({ type: 'LOG', entry: kbdLog(`Opening ${path}…`, 'info') })
        const proj = await loadProjectFile(path)
        if (!proj) {
          dispatch({ type: 'LOG', entry: kbdLog('✗ Failed to parse project.json', 'error') })
          return
        }
        dispatch({ type: 'LOAD_PROJECT', project: proj, path })
        dispatch({ type: 'LOG', entry: kbdLog(`✓ Loaded "${proj.projectName}" v${proj.version}`, 'info') })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.openScripts, state.activeScriptPath, state.project, state.projectPath, state.mode, dispatch])

  return (
    <div className="flex w-full h-full bg-[var(--bg)] text-[var(--text)] overflow-hidden select-none">
      <ModuleRail />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MenuBar />

        {/* Only CanvasView must stay MOUNTED: unmounting it would detach the
            WASM canvas while Emscripten keeps rendering into the removed node
            → empty viewport on return. It is kept alive via display toggling
            (`contents` when active, `none` when hidden).

            LogicBoardView / ScriptEditorView have NO WASM canvas, so they are
            mounted CONDITIONALLY. This is required for Monaco: a permanently
            mounted editor inside a `display:contents` (boxless) ancestor has
            no containing block for its `height:100%`, so it laid out at ~0px
            and stayed compact (text rendered at the top until a relayout).
            Mounting only when active gives Monaco a real, sized box. */}
        <div style={{ display: state.mode === 'canvas' ? 'contents' : 'none' }}>
          <CanvasView />
        </div>
        {state.mode === 'logic'  && <LogicBoardView />}
        {state.mode === 'script' && <ScriptEditorView />}

        <StatusBar />
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
