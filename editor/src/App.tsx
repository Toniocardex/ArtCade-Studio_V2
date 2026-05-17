import { useEffect }       from 'react'
import { EditorProvider, useEditor } from './store/editor-store'
import MenuBar            from './components/MenuBar'
import StatusBar          from './components/StatusBar'
import HierarchyPanel     from './panels/HierarchyPanel'
import PreviewPanel       from './panels/PreviewPanel'
import InspectorPanel     from './panels/InspectorPanel'
import LogicBoardPanel    from './panels/LogicBoardPanel'
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
  { id: 'assets',  label: 'ASSETS',        color: '#00FFFF' },
  { id: 'tileset', label: 'TILESET_EDITOR', color: '#FF00FF' },
  { id: 'console', label: 'CONSOLE',       color: '#D1D5DB' },
]

function BottomPanel() {
  const { state, dispatch } = useEditor()
  const { bottomTab } = state

  return (
    <div className="h-64 border-t border-[#1A253A] bg-[#0B1121] flex flex-col flex-shrink-0">
      {/* Tab bar */}
      <div className="flex border-b border-[#1A253A] px-2 flex-shrink-0">
        {BOTTOM_TABS.map(tab => {
          const active = bottomTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_BOTTOM_TAB', tab: tab.id })}
              className={`px-4 py-2 text-[10px] font-bold transition-all whitespace-nowrap ${
                active
                  ? 'border-b-2'
                  : 'text-[#9CA3AF] hover:text-[#D1D5DB]'
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
// SCENE_VIEW layout: hierarchy | viewport+bottom | inspector
// ---------------------------------------------------------------------------

function SceneView() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Left sidebar — Hierarchy */}
      <aside className="w-64 border-r border-[#1A253A] flex-shrink-0 overflow-hidden">
        <HierarchyPanel />
      </aside>

      {/* Center — Viewport + bottom panel stacked */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#111827]">
        <div className="flex-1 min-h-0 overflow-hidden">
          <PreviewPanel />
        </div>
        <BottomPanel />
      </section>

      {/* Right sidebar — Inspector */}
      <aside className="w-72 border-l border-[#1A253A] flex-shrink-0 overflow-hidden">
        <InspectorPanel />
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LOGIC_BOARD view: full-screen Monaco editor
// ---------------------------------------------------------------------------

function LogicBoardView() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <LogicBoardPanel />
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
        if (state.view !== 'logic') {
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
  }, [state.openScripts, state.activeScriptPath, state.project, state.projectPath, state.view, dispatch])

  return (
    <div className="flex flex-col w-full h-full bg-[#0B1121] text-[#D1D5DB] overflow-hidden select-none">
      <MenuBar />

      {state.view === 'scene'
        ? <SceneView />
        : <LogicBoardView />
      }

      <StatusBar />
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
