import { useRef, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Play, Square, FolderOpen, Save, Package, Hammer, ChevronDown, FilePlus } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import {
  openProjectDialog, loadProjectFile,
  saveScript, saveProjectFile, savePackDialog, packProject, runBuild,
  saveProjectAsDialog, scaffoldNewProjectOnDisk,
} from '../utils/api'
import { dirName, createBlankProject, BLANK_MAIN_LUA } from '../utils/project'
import { runtimeSync } from '../utils/runtime-sync-service'
import { resolvePreviewMainLua } from '../utils/preview-restore'
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
                    bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-2xl
                    min-w-[220px] py-1 select-none">
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && i > 0 && (
            <div className="my-1 border-t border-[var(--border)]" />
          )}
          <button
            onClick={item.action}
            className="w-full flex items-center gap-3 px-4 py-2
                       text-[11px] text-[var(--text)] hover:bg-[var(--panel-3)]
                       hover:text-[var(--text)] transition-colors text-left"
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
  const { isPlaying, project, projectPath, projectDirty, openScripts, activeScriptPath, selection } = state

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

  /** Confirm-then-discard guard before replacing the in-memory project. */
  function confirmDiscardIfDirty(actionLabel: string): boolean {
    if (!projectDirty) return true
    // Browser-mode fallback uses window.confirm; in Tauri the bundled
    // WebView shows the standard OS confirm dialog.
    return window.confirm(
      `You have unsaved changes in "${project?.projectName ?? 'this project'}".\n` +
      `${actionLabel} will discard them. Continue?`
    )
  }

  async function handleOpenProject() {
    setFileMenuOpen(false)
    if (!confirmDiscardIfDirty('Opening a different project')) return
    const path = await openProjectDialog()
    if (!path) return
    dispatch({ type: 'LOG', entry: makeLog(`[File] Opening ${path}…`, 'info') })
    const proj = await loadProjectFile(path)
    if (!proj) {
      dispatch({ type: 'LOG', entry: makeLog('[File] ✗ Failed to parse project.json', 'error') })
      return
    }
    runtimeSync.reset()
    dispatch({ type: 'LOAD_PROJECT', project: proj, path })
    dispatch({ type: 'LOG', entry: makeLog(`[File] ✓ Loaded "${proj.projectName}" v${proj.version}`, 'info') })
  }

  /**
   * File → New Project: replace the editor state with a blank, runnable
   * ProjectDoc *in memory*. projectPath stays null until the user runs
   * Save Project As… (the next menu entry).
   */
  async function handleNewProject() {
    setFileMenuOpen(false)
    if (!confirmDiscardIfDirty('Creating a new project')) return
    const blank = createBlankProject('Untitled')
    runtimeSync.reset()
    // LOAD_PROJECT resets script buffers, selection, isPlaying, ecc.
    // path='' marks the project as in-memory only — Ctrl+S will route to
    // Save Project As… (see handleSaveProject below).
    dispatch({ type: 'LOAD_PROJECT', project: blank, path: '' })
    dispatch({ type: 'LOG', entry: makeLog('[File] OK new blank project (unsaved – use Save Project As to persist).', 'info') })
  }

  /**
   * File → Save Project As…: ask for a destination, write project.json plus
   * scripts/main.lua, then promote the in-memory state to "saved on disk".
   */
  async function handleSaveProjectAs() {
    setFileMenuOpen(false)
    if (!project) {
      dispatch({ type: 'LOG', entry: makeLog('[File] No project to save.', 'warn') })
      return
    }
    const target = await saveProjectAsDialog()
    if (!target) return
    try {
      await scaffoldNewProjectOnDisk(target, project, BLANK_MAIN_LUA)
      // Promote in-memory state to the new path.
      dispatch({ type: 'LOAD_PROJECT', project, path: target })
      dispatch({ type: 'MARK_PROJECT_SAVED' })
      dispatch({ type: 'LOG', entry: makeLog(`[File] ✓ Saved project to ${target}`, 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeLog(`[File] ✗ Save As failed: ${err}`, 'error') })
    }
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
    if (!project) {
      dispatch({ type: 'LOG', entry: makeLog('[File] No project loaded.', 'warn') })
      return
    }
    // In-memory only (path='' after New Project) → fall through to Save As.
    if (!projectPath) {
      await handleSaveProjectAs()
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

  function handlePlayStop() {
    if (isPlaying) {
      dispatch({ type: 'SET_PLAYING', playing: false })
      if (project) {
        const activeSceneId = selection.sceneId ?? project.activeSceneId
        const mainLua = resolvePreviewMainLua({ project, openScripts })
        const ok = runtimeSync.restorePreviewFromProject(project, activeSceneId, mainLua)
        if (!ok) {
          dispatch({
            type: 'LOG',
            entry: makeLog('[Preview] Runtime not ready — open Canvas preview first.', 'warn'),
          })
        }
      }
    } else {
      dispatch({ type: 'SET_PLAYING', playing: true })
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
      label:    'New Project',
      icon:     <FilePlus size={12} />,
      shortcut: 'Ctrl+N',
      action:   handleNewProject,
    },
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
      label:    'Save Project As…',
      icon:     <Save size={12} />,
      shortcut: 'Ctrl+Shift+S',
      action:   handleSaveProjectAs,
    },
    {
      label:    'Save Script',
      icon:     <Save size={12} />,
      shortcut: '',
      action:   handleSaveScript,
      divider:  true,
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
    <header
      className="editor-toolbar flex items-center justify-between flex-shrink-0 z-50 select-none"
    >
      <div ref={fileMenuRef} className="relative flex items-center editor-toolbar-workspace-start">
        <button
          type="button"
          onClick={() => setFileMenuOpen(v => !v)}
          className={`editor-toolbar-btn border ${
            fileMenuOpen
              ? 'border-[var(--border-2)] bg-[var(--border)] text-[var(--text)]'
              : 'border-[var(--border)] bg-[var(--panel-3)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-2)]'
          }`}
        >
          FILE
          <ChevronDown size={10} className={`transition-transform ${fileMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {fileMenuOpen && <FileMenu items={fileItems} />}
      </div>

      <div className="flex items-center gap-2.5 editor-toolbar-workspace-end">
        <button
          type="button"
          onClick={handlePlayStop}
          className={`editor-toolbar-btn border ${
            isPlaying
              ? 'border-[var(--danger)] bg-[rgb(var(--danger-rgb)/0.12)] text-[var(--danger)] hover:bg-[rgb(var(--danger-rgb)/0.2)]'
              : 'border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]'
          }`}
        >
          {isPlaying
            ? <Square size={12} fill="currentColor" />
            : <Play size={12} fill="currentColor" />}
          {isPlaying ? 'STOP' : 'PLAY'}
        </button>

        <button
          type="button"
          onClick={handleBuildExe}
          disabled={isBuilding}
          className={`editor-toolbar-btn text-[var(--bg)] ${
            isBuilding
              ? 'bg-[rgb(var(--accent-2-rgb)/0.45)] cursor-not-allowed'
              : 'bg-[var(--accent-2)] hover:brightness-110 shadow-sm'
          }`}
        >
          <Hammer size={12} className={isBuilding ? 'animate-bounce' : ''} />
          {isBuilding ? 'BUILDING…' : 'BUILD .EXE'}
        </button>
      </div>
    </header>
  )
}
