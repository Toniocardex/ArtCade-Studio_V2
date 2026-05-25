import { useRef, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Play, Square, FolderOpen, Save, Package, Hammer, ChevronDown, FilePlus, Globe2, PencilLine, ExternalLink } from 'lucide-react'
import { useEditor } from '../store/editor-store'
import {
  openProjectDialog, loadProjectFile,
  saveScript, saveProjectFile, savePackDialog, packProject, runBuild, runBuildWasm,
  openWebExportInBrowser,
  saveProjectAsDialog, scaffoldNewProjectOnDisk, resolveScriptPath,
  ensureDependencies, checkDependencies,
} from '../utils/api'
import { dirName, createBlankProject, BLANK_MAIN_LUA, safeProjectFolderName } from '../utils/project'
import { runtimeSync } from '../utils/runtime-sync-service'
import { resolvePreviewMainLua } from '../utils/preview-restore'
import { compileLogicBoard } from '../utils/logic-board/compiler'
import type { ConsoleEntry, ProjectDoc } from '../types'

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

function mainScriptBodyForProject(project: ProjectDoc): string {
  return project.logicBoards?.length
    ? compileLogicBoard(project.logicBoards, project)
    : BLANK_MAIN_LUA
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
                    bg-[var(--panel)] border border-[var(--border-2)] rounded
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
  const [isBuildingWeb, setIsBuildingWeb] = useState(false)
  const [isOpeningWeb, setIsOpeningWeb] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState(project?.projectName ?? 'Untitled')
  const fileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setProjectNameDraft(project?.projectName ?? 'Untitled')
  }, [project?.projectName])

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

  function commitProjectNameDraft() {
    if (!project) return
    const nextName = safeProjectFolderName(projectNameDraft, 'Untitled')
    setProjectNameDraft(nextName)
    dispatch({ type: 'PROJECT_RENAME', name: nextName })
  }

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
    const target = await saveProjectAsDialog(project.projectName)
    if (!target) return
    try {
      const projectJsonPath = await scaffoldNewProjectOnDisk(target, project, mainScriptBodyForProject(project))
      // Promote in-memory state to the new path.
      dispatch({ type: 'LOAD_PROJECT', project, path: projectJsonPath })
      dispatch({ type: 'MARK_PROJECT_SAVED' })
      dispatch({ type: 'LOG', entry: makeLog(`[File] Saved project to ${projectJsonPath}`, 'info') })
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
      // openScripts.path is typically project-relative (e.g. "scripts/main.lua")
      // — write_file would otherwise resolve it against the process cwd and
      // either fail or scribble outside the project root.
      const absPath = resolveScriptPath(projectPath, script.path)
      await saveScript(absPath, script.content)
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
    if (!project) {
      dispatch({ type: 'LOG', entry: makeLog('[Pack] No project in memory.', 'warn') })
      return
    }
    const output = await savePackDialog()
    if (!output) return
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    if (!await ensureDependencies('pack')) return
    const root = dirName(projectPath)

    // The C++ runtime ignores ProjectDoc.logicBoards — it only executes
    // scripts/mainScriptPath. Before packing we must compile the visual
    // Logic Board into Lua and persist it onto the main script on disk,
    // otherwise the .artcade ships with the empty stub and KeyA/KeyD do
    // nothing in the published game.exe.
    const mainScriptPath = project.mainScriptPath
    if (mainScriptPath && project.logicBoards && project.logicBoards.length > 0) {
      try {
        const compiled = compileLogicBoard(project.logicBoards, project)
        const absScriptPath = resolveScriptPath(projectPath, mainScriptPath)
        await saveScript(absScriptPath, compiled)
        // Mirror the on-disk content into the in-memory script buffer so the
        // editor tab does not stay marked dirty / out of sync after packing.
        dispatch({
          type: 'UPSERT_SCRIPT',
          path: mainScriptPath,
          content: compiled,
          isDirty: false,
          activate: false,
        })
        dispatch({ type: 'LOG', entry: makeLog(
          `[Pack] Logic Board compiled → ${mainScriptPath}`, 'info') })
      } catch (err) {
        dispatch({ type: 'LOG', entry: makeLog(
          `[Pack] ✗ Logic Board compile failed: ${err}`, 'error') })
        return
      }
    }

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

  async function ensureProjectReadyForBuild(kind: 'Build' | 'WASM' | 'Web'): Promise<string | null> {
    if (!project) {
      dispatch({ type: 'LOG', entry: makeLog(`[${kind}] No project loaded.`, 'warn') })
      return null
    }

    let buildPath = projectPath ?? ''
    if (!buildPath) {
      const ok = window.confirm('The project has not been saved.\nSave it now before building?')
      if (!ok) return null
      const target = (await saveProjectAsDialog(project.projectName))!
      if (!target) return null
      try {
        const projectJsonPath = await scaffoldNewProjectOnDisk(target, project, mainScriptBodyForProject(project))
        dispatch({ type: 'LOAD_PROJECT', project, path: projectJsonPath })
        dispatch({ type: 'MARK_PROJECT_SAVED' })
        buildPath = projectJsonPath
        dispatch({ type: 'LOG', entry: makeLog(`[File] Saved "${project.projectName}" to ${projectJsonPath}`, 'info') })
      } catch (err) {
        dispatch({ type: 'LOG', entry: makeLog(`[File] ✗ Save failed: ${err}`, 'error') })
        return null
      }
    }

    try {
      await saveProjectFile(buildPath, project)
      dispatch({ type: 'MARK_PROJECT_SAVED' })

      if (project.mainScriptPath && project.logicBoards?.length) {
        const compiled = compileLogicBoard(project.logicBoards ?? [], project)
        await saveScript(resolveScriptPath(buildPath, project.mainScriptPath), compiled)
        dispatch({
          type: 'UPSERT_SCRIPT',
          path: project.mainScriptPath,
          content: compiled,
          isDirty: false,
          activate: false,
        })
        dispatch({ type: 'LOG', entry: makeLog(`[${kind}] Logic Board compiled -> ${project.mainScriptPath}`, 'info') })
      }
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeLog(`[${kind}] Prepare project failed: ${err}`, 'error') })
      return null
    }

    return buildPath
  }

  async function handleBuildExe() {
    setIsBuilding(true)
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    if (!await ensureDependencies('native')) {
      setIsBuilding(false)
      return
    }
    const preparedBuildPath = await ensureProjectReadyForBuild('Build')
    if (!preparedBuildPath) {
      setIsBuilding(false)
      return
    }
    dispatch({ type: 'LOG', entry: makeLog('[Build] Starting cmake build...', 'info') })
    try {
      await runBuild(dirName(preparedBuildPath))
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeLog(`[Build] Failed: ${err}`, 'error') })
    } finally {
      setIsBuilding(false)
    }
    return
  }


  async function handleBuildWeb() {
    setIsBuildingWeb(true)
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    if (!await ensureDependencies('wasm')) {
      setIsBuildingWeb(false)
      return
    }
    const buildPath = await ensureProjectReadyForBuild('WASM')
    if (!buildPath) {
      setIsBuildingWeb(false)
      return
    }
    dispatch({ type: 'LOG', entry: makeLog('[WASM] Starting web export...', 'info') })
    try {
      await runBuildWasm(dirName(buildPath))
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeLog(`[WASM] Failed: ${err}`, 'error') })
    } finally {
      setIsBuildingWeb(false)
    }
  }

  async function handleOpenWebInBrowser() {
    if (!project) {
      dispatch({ type: 'LOG', entry: makeLog('[Web] No project loaded.', 'warn') })
      return
    }
    setIsOpeningWeb(true)
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    const root = await ensureProjectReadyForBuild('Web')
    if (!root) {
      setIsOpeningWeb(false)
      return
    }
    dispatch({ type: 'LOG', entry: makeLog('[Web] Starting local preview server...', 'info') })
    try {
      const url = await openWebExportInBrowser(dirName(root))
      dispatch({ type: 'LOG', entry: makeLog(`[Web] Browser opened at ${url}`, 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeLog(`[Web] ${err}`, 'error') })
    } finally {
      setIsOpeningWeb(false)
    }
  }

  async function handleCheckDependencies() {
    setFileMenuOpen(false)
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    const report = await checkDependencies()
    if (!report) return
    const { formatDependencyReport } = await import('../utils/dependencies')
    dispatch({
      type: 'LOG',
      entry: makeLog(`[Setup] Dependencies\n${formatDependencyReport(report)}`, 'info'),
    })
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
    {
      label:    'Check dependencies…',
      icon:     <Hammer size={12} />,
      shortcut: '',
      action:   handleCheckDependencies,
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
        {project && (
          <label
            className="ml-3 h-8 min-w-[180px] max-w-[320px] flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--panel-3)] px-2 text-[var(--muted)]"
            title="Project name"
          >
            <PencilLine size={12} className="shrink-0" />
            <input
              value={projectNameDraft}
              onChange={(e) => setProjectNameDraft(e.target.value)}
              onBlur={commitProjectNameDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                } else if (e.key === 'Escape') {
                  setProjectNameDraft(project.projectName)
                  e.currentTarget.blur()
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[var(--text)] outline-none"
              aria-label="Project name"
            />
          </label>
        )}
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
          disabled={isBuilding || isBuildingWeb || isOpeningWeb}
          className={`editor-toolbar-btn border ${
            isBuilding
              ? 'border-[var(--border-2)] bg-[var(--panel)] text-[var(--muted)] cursor-not-allowed'
              : 'border-[var(--border-2)] bg-transparent text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)]'
          }`}
        >
          <Hammer size={12} className={isBuilding ? 'animate-pulse' : ''} />
          {isBuilding ? 'BUILDING…' : 'BUILD .EXE'}
        </button>

        <button
          type="button"
          onClick={handleBuildWeb}
          disabled={isBuilding || isBuildingWeb || isOpeningWeb}
          className={`editor-toolbar-btn border ${
            isBuildingWeb
              ? 'border-[var(--border-2)] bg-[var(--panel)] text-[var(--muted)] cursor-not-allowed'
              : 'border-[var(--border-2)] bg-transparent text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)]'
          }`}
        >
          <Globe2 size={12} className={isBuildingWeb ? 'animate-pulse' : ''} />
          {isBuildingWeb ? 'EXPORTING...' : 'BUILD WEB'}
        </button>

        <button
          type="button"
          onClick={handleOpenWebInBrowser}
          disabled={!project || isBuilding || isBuildingWeb || isOpeningWeb}
          title={project ? 'Serve web export on localhost and open in browser' : 'Load a project first'}
          className={`editor-toolbar-btn border ${
            isOpeningWeb
              ? 'border-[var(--border-2)] bg-[var(--panel)] text-[var(--muted)] cursor-not-allowed'
              : !project
                ? 'border-[var(--border)] bg-transparent text-[var(--muted)] cursor-not-allowed opacity-60'
                : 'border-[var(--border-2)] bg-transparent text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-bg)]'
          }`}
        >
          <ExternalLink size={12} className={isOpeningWeb ? 'animate-pulse' : ''} />
          {isOpeningWeb ? 'OPENING…' : 'OPEN IN BROWSER'}
        </button>
      </div>
    </header>
  )
}
