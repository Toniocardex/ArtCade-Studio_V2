import { useRef, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Cpu, Play, Square, FolderOpen, Save, Package, Hammer, ChevronDown, Sun, Moon } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import { applyTheme, toggleTheme, type Theme } from '../utils/theme'
import {
  openProjectDialog, loadProjectFile,
  saveScript, saveProjectFile, savePackDialog, packProject, runBuild,
} from '../utils/api'
import { dirName } from '../utils/project'
import type { ConsoleEntry } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _logId = 100
function makeLog(message: string, level: ConsoleEntry['level']): ConsoleEntry {
  const now = new Date()
  return {
    id:      ++_logId,
    time:    now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    message,
    level,
  }
}

// ---------------------------------------------------------------------------
// File dropdown menu
// ---------------------------------------------------------------------------

interface FileMenuItem {
  label:    string
  icon:     ReactNode
  shortcut: string
  action:   () => void
  divider?: boolean
}

function FileMenu({ items }: { items: FileMenuItem[] }) {
  return (
    <div className="absolute top-full left-0 mt-1 z-[999]
                    bg-[var(--bg)] border border-[var(--border)] rounded shadow-2xl
                    min-w-[220px] py-1 select-none">
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && i > 0 && (
            <div className="my-1 border-t border-[var(--border)]" />
          )}
          <button
            onClick={item.action}
            className="w-full flex items-center gap-3 px-4 py-2
                       text-[11px] text-[var(--text)] hover:bg-[var(--border)]
                       hover:text-white transition-colors text-left"
          >
            <span className="text-[var(--muted)] flex-shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            <span className="text-[rgb(var(--muted-rgb)/0.6)] font-mono text-[9px]">{item.shortcut}</span>
          </button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MenuBar
// ---------------------------------------------------------------------------

export default function MenuBar() {
  const { state, dispatch } = useEditor()
  const { view, isPlaying, project, projectPath, projectDirty, openScripts, activeScriptPath } = state
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute('data-theme') as Theme) || 'dark',
  )

  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [isBuilding,   setIsBuilding]   = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)

  // Close file menu on outside click
  useEffect(() => {
    if (!fileMenuOpen) return
    function onDown(e: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [fileMenuOpen])

  // ---- actions -----------------------------------------------------------

  async function handleOpenProject() {
    setFileMenuOpen(false)
    const path = await openProjectDialog()
    if (!path) return
    dispatch({ type: 'LOG', entry: makeLog(`[File] Opening ${path}…`, 'info') })
    const proj = await loadProjectFile(path)
    if (!proj) {
      dispatch({ type: 'LOG', entry: makeLog('[File] ✗ Failed to parse project.json', 'error') })
      return
    }
    dispatch({ type: 'LOAD_PROJECT', project: proj, path })
    dispatch({ type: 'LOG', entry: makeLog(`[File] ✓ Loaded "${proj.projectName}" v${proj.version}`, 'info') })
  }

  async function handleSaveScript() {
    setFileMenuOpen(false)
    const script = openScripts.find(s => s.path === activeScriptPath)
    if (!script) {
      dispatch({ type: 'LOG', entry: makeLog('[File] No active script to save.', 'warn') })
      return
    }
    if (!script.isDirty) {
      dispatch({ type: 'LOG', entry: makeLog(`[File] "${script.path}" already saved.`, 'info') })
      return
    }
    try {
      await saveScript(script.path, script.content)
      dispatch({ type: 'MARK_SCRIPT_SAVED', path: script.path })
      dispatch({ type: 'LOG', entry: makeLog(`[File] ✓ Saved "${script.path}"`, 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeLog(`[File] ✗ Save failed: ${err}`, 'error') })
    }
  }

  async function handleSaveProject() {
    setFileMenuOpen(false)
    if (!project || !projectPath) {
      dispatch({ type: 'LOG', entry: makeLog('[File] No project loaded.', 'warn') })
      return
    }
    try {
      await saveProjectFile(projectPath, project)
      dispatch({ type: 'MARK_PROJECT_SAVED' })
      dispatch({ type: 'LOG', entry: makeLog(`[File] Saved project "${project.projectName}"`, 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeLog(`[File] Save project failed: ${err}`, 'error') })
    }
  }

  async function handlePackArtcade() {
    setFileMenuOpen(false)
    if (!projectPath) {
      dispatch({ type: 'LOG', entry: makeLog('[Pack] No project loaded.', 'warn') })
      return
    }
    const output = await savePackDialog()
    if (!output) return
    const root = dirName(projectPath)
    dispatch({ type: 'SET_BOTTOM_TAB', tab: 'console' })
    dispatch({ type: 'LOG', entry: makeLog(`[Pack] Packing → ${output}`, 'info') })
    try {
      await packProject(root, output)
      dispatch({ type: 'LOG', entry: makeLog('[Pack] ✓ .artcade created.', 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeLog(`[Pack] ✗ ${err}`, 'error') })
    }
  }

  async function handleBuildExe() {
    if (!projectPath) {
      dispatch({ type: 'LOG', entry: makeLog('[Build] No project loaded.', 'warn') })
      return
    }
    const root = dirName(projectPath)
    setIsBuilding(true)
    dispatch({ type: 'SET_BOTTOM_TAB', tab: 'console' })
    dispatch({ type: 'LOG', entry: makeLog('[Build] Starting cmake build…', 'info') })
    try {
      await runBuild(root)
      // Success / failure logs come from Tauri "build-log" events streamed to ConsolePanel
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeLog(`[Build] ✗ ${err}`, 'error') })
    } finally {
      setIsBuilding(false)
    }
  }

  // ---- file menu items ---------------------------------------------------

  const fileItems: FileMenuItem[] = [
    {
      label:    'Open Project…',
      icon:     <FolderOpen size={12} />,
      shortcut: 'Ctrl+O',
      action:   handleOpenProject,
    },
    {
      label:    projectDirty ? 'Save Project *' : 'Save Project',
      icon:     <Save size={12} />,
      shortcut: 'Ctrl+S',
      action:   handleSaveProject,
      divider:  true,
    },
    {
      label:    'Save Script',
      icon:     <Save size={12} />,
      shortcut: '',
      action:   handleSaveScript,
    },
    {
      label:    'Pack .artcade…',
      icon:     <Package size={12} />,
      shortcut: '',
      action:   handlePackArtcade,
      divider:  true,
    },
  ]

  // ---- render ------------------------------------------------------------

  return (
    <header className="h-12 border-b border-[var(--border)] bg-[var(--bg)]
                       flex items-center justify-between px-4 flex-shrink-0 z-50 select-none">

      {/* ── Left: logo + view toggle + file menu ── */}
      <div className="flex items-center gap-4">

        {/* Logo */}
        <div className="flex items-center gap-2 text-[var(--accent)] font-bold text-lg tracking-tighter">
          <Cpu size={20} />
          <span>Artcade</span>
          <span className="text-xs text-[var(--muted)] font-normal tracking-normal ml-1">
            v2.0 — {project?.projectName ?? 'No Project'}
          </span>
        </div>

        {/* File dropdown */}
        <div ref={fileMenuRef} className="relative">
          <button
            onClick={() => setFileMenuOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold
                        transition-colors ${
              fileMenuOpen
                ? 'bg-[var(--border)] text-[var(--text)]'
                : 'text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--text)]'
            }`}
          >
            FILE
            <ChevronDown size={10} className={`transition-transform ${fileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {fileMenuOpen && <FileMenu items={fileItems} />}
        </div>

        {/* Scene / Logic toggle */}
        <div className="flex bg-[var(--border)] rounded p-1 gap-0.5">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'scene' })}
            className={`px-4 py-1 text-[10px] rounded font-bold transition-all ${
              view === 'scene'
                ? 'bg-[var(--accent)] text-[var(--bg)]'
                : 'text-[var(--muted)] hover:bg-white/5'
            }`}
          >
            SCENE_VIEW
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'logic' })}
            className={`px-4 py-1 text-[10px] rounded font-bold transition-all ${
              view === 'logic'
                ? 'bg-[var(--accent-2)] text-[var(--bg)]'
                : 'text-[var(--muted)] hover:bg-white/5'
            }`}
          >
            LOGIC_BOARD
          </button>
        </div>
      </div>

      {/* ── Right: theme + play + build ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const next = toggleTheme(theme)
            applyTheme(next)
            setTheme(next)
          }}
          title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
          className="flex items-center justify-center w-7 h-7 rounded border
                     border-[var(--border-2)] text-[var(--muted)]
                     hover:text-[var(--accent)] hover:border-[var(--accent-bd)] transition-all"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <button
          onClick={() => dispatch({ type: 'SET_PLAYING', playing: !isPlaying })}
          className={`flex items-center gap-2 px-4 py-1 rounded border text-xs font-bold transition-all ${
            isPlaying
              ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30'
              : 'bg-[rgb(var(--accent-rgb)/0.1)] border-[var(--accent)] text-[var(--accent)] hover:bg-[rgb(var(--accent-rgb)/0.2)]'
          }`}
        >
          {isPlaying
            ? <Square size={12} fill="currentColor" />
            : <Play   size={12} fill="currentColor" />}
          {isPlaying ? 'STOP' : 'PLAY'}
        </button>

        <button
          onClick={handleBuildExe}
          disabled={isBuilding}
          className={`flex items-center gap-2 px-3 py-1 text-[var(--bg)] text-xs font-bold
                      rounded transition-all ${
            isBuilding
              ? 'bg-[rgb(var(--accent-2-rgb)/0.5)] cursor-not-allowed'
              : 'bg-[var(--accent-2)] hover:opacity-90'
          }`}
        >
          <Hammer size={12} className={isBuilding ? 'animate-bounce' : ''} />
          {isBuilding ? 'BUILDING…' : 'BUILD .EXE'}
        </button>
      </div>
    </header>
  )
}
