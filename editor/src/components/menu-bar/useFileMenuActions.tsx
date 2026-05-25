import { useCallback, useMemo } from 'react'
import type { Dispatch } from 'react'
import { FilePlus, FolderOpen, Save, Package, Hammer } from 'lucide-react'
import type { Action as EditorAction, CoreState } from '../../store/editor-store'
import {
  openProjectDialog,
  loadProjectFile,
  saveScript,
  saveProjectFile,
  savePackDialog,
  packProject,
  saveProjectAsDialog,
  scaffoldNewProjectOnDisk,
  resolveScriptPath,
  ensureDependencies,
  checkDependencies,
} from '../../utils/api'
import { dirName, createBlankProject } from '../../utils/project'
import { runtimeSync } from '../../utils/runtime-sync-service'
import { compileLogicBoard } from '../../utils/logic-board/compiler'
import type { ProjectDoc } from '../../types'
import type { FileMenuItem } from './FileMenu'
import { makeConsoleEntry } from './makeConsoleEntry'
import { mainScriptBodyForProject } from './project-script'

interface UseFileMenuActionsParams {
  dispatch: Dispatch<EditorAction>
  project: ProjectDoc | null
  projectPath: string | null
  projectDirty: boolean
  openScripts: CoreState['openScripts']
  activeScriptPath: string | null
  closeMenu: () => void
}

export function useFileMenuActions({
  dispatch,
  project,
  projectPath,
  projectDirty,
  openScripts,
  activeScriptPath,
  closeMenu,
}: UseFileMenuActionsParams) {
  const confirmDiscardIfDirty = useCallback(
    (actionLabel: string): boolean => {
      if (!projectDirty) return true
      return window.confirm(
        `You have unsaved changes in "${project?.projectName ?? 'this project'}".\n` +
          `${actionLabel} will discard them. Continue?`,
      )
    },
    [project?.projectName, projectDirty],
  )

  const handleOpenProject = useCallback(async () => {
    closeMenu()
    if (!confirmDiscardIfDirty('Opening a different project')) return
    const path = await openProjectDialog()
    if (!path) return
    dispatch({ type: 'LOG', entry: makeConsoleEntry(`[File] Opening ${path}…`, 'info') })
    const proj = await loadProjectFile(path)
    if (!proj) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[File] ✗ Failed to parse project.json', 'error') })
      return
    }
    runtimeSync.reset()
    dispatch({ type: 'LOAD_PROJECT', project: proj, path })
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(`[File] ✓ Loaded "${proj.projectName}" v${proj.version}`, 'info'),
    })
  }, [closeMenu, confirmDiscardIfDirty, dispatch])

  const handleNewProject = useCallback(async () => {
    closeMenu()
    if (!confirmDiscardIfDirty('Creating a new project')) return
    const blank = createBlankProject('Untitled')
    runtimeSync.reset()
    dispatch({ type: 'LOAD_PROJECT', project: blank, path: '' })
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(
        '[File] OK new blank project (unsaved – use Save Project As to persist).',
        'info',
      ),
    })
  }, [closeMenu, confirmDiscardIfDirty, dispatch])

  const handleSaveProjectAs = useCallback(async () => {
    closeMenu()
    if (!project) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[File] No project to save.', 'warn') })
      return
    }
    const target = await saveProjectAsDialog(project.projectName)
    if (!target) return
    try {
      const projectJsonPath = await scaffoldNewProjectOnDisk(
        target,
        project,
        mainScriptBodyForProject(project),
      )
      dispatch({ type: 'LOAD_PROJECT', project, path: projectJsonPath })
      dispatch({ type: 'MARK_PROJECT_SAVED' })
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[File] Saved project to ${projectJsonPath}`, 'info'),
      })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[File] ✗ Save As failed: ${err}`, 'error') })
    }
  }, [closeMenu, dispatch, project])

  const handleSaveScript = useCallback(async () => {
    closeMenu()
    const script = openScripts.find((s) => s.path === activeScriptPath)
    if (!script) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[File] No active script to save.', 'warn') })
      return
    }
    if (!script.isDirty) {
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[File] "${script.path}" already saved.`, 'info'),
      })
      return
    }
    try {
      const absPath = resolveScriptPath(projectPath, script.path)
      await saveScript(absPath, script.content)
      dispatch({ type: 'MARK_SCRIPT_SAVED', path: script.path })
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[File] ✓ Saved "${script.path}"`, 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[File] ✗ Save failed: ${err}`, 'error') })
    }
  }, [activeScriptPath, closeMenu, dispatch, openScripts, projectPath])

  const handleSaveProject = useCallback(async () => {
    closeMenu()
    if (!project) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[File] No project loaded.', 'warn') })
      return
    }
    if (!projectPath) {
      await handleSaveProjectAs()
      return
    }
    try {
      await saveProjectFile(projectPath, project)
      dispatch({ type: 'MARK_PROJECT_SAVED' })
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[File] Saved project "${project.projectName}"`, 'info'),
      })
    } catch (err) {
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[File] Save project failed: ${err}`, 'error'),
      })
    }
  }, [closeMenu, dispatch, handleSaveProjectAs, project, projectPath])

  const handlePackArtcade = useCallback(async () => {
    closeMenu()
    if (!projectPath) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[Pack] No project loaded.', 'warn') })
      return
    }
    if (!project) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[Pack] No project in memory.', 'warn') })
      return
    }
    const output = await savePackDialog()
    if (!output) return
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    if (!(await ensureDependencies('pack'))) return
    const root = dirName(projectPath)

    const mainScriptPath = project.mainScriptPath
    if (mainScriptPath && project.logicBoards && project.logicBoards.length > 0) {
      try {
        const compiled = compileLogicBoard(project.logicBoards, project)
        const absScriptPath = resolveScriptPath(projectPath, mainScriptPath)
        await saveScript(absScriptPath, compiled)
        dispatch({
          type: 'UPSERT_SCRIPT',
          path: mainScriptPath,
          content: compiled,
          isDirty: false,
          activate: false,
        })
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(`[Pack] Logic Board compiled → ${mainScriptPath}`, 'info'),
        })
      } catch (err) {
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(`[Pack] ✗ Logic Board compile failed: ${err}`, 'error'),
        })
        return
      }
    }

    dispatch({ type: 'LOG', entry: makeConsoleEntry(`[Pack] Packing → ${output}`, 'info') })
    try {
      await packProject(root, output)
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[Pack] ✓ .artcade created.', 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[Pack] ✗ ${err}`, 'error') })
    }
  }, [closeMenu, dispatch, project, projectPath])

  const handleCheckDependencies = useCallback(async () => {
    closeMenu()
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    const report = await checkDependencies()
    if (!report) return
    const { formatDependencyReport } = await import('../../utils/dependencies')
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(`[Setup] Dependencies\n${formatDependencyReport(report)}`, 'info'),
    })
  }, [closeMenu, dispatch])

  const fileItems: FileMenuItem[] = useMemo(
    () => [
      {
        label: 'New Project',
        icon: <FilePlus size={12} />,
        shortcut: 'Ctrl+N',
        action: handleNewProject,
      },
      {
        label: 'Open Project…',
        icon: <FolderOpen size={12} />,
        shortcut: 'Ctrl+O',
        action: handleOpenProject,
      },
      {
        label: projectDirty ? 'Save Project *' : 'Save Project',
        icon: <Save size={12} />,
        shortcut: 'Ctrl+S',
        action: handleSaveProject,
        divider: true,
      },
      {
        label: 'Save Project As…',
        icon: <Save size={12} />,
        shortcut: 'Ctrl+Shift+S',
        action: handleSaveProjectAs,
      },
      {
        label: 'Save Script',
        icon: <Save size={12} />,
        shortcut: '',
        action: handleSaveScript,
        divider: true,
      },
      {
        label: 'Pack .artcade…',
        icon: <Package size={12} />,
        shortcut: '',
        action: handlePackArtcade,
        divider: true,
      },
      {
        label: 'Check dependencies…',
        icon: <Hammer size={12} />,
        shortcut: '',
        action: handleCheckDependencies,
      },
    ],
    [
      handleCheckDependencies,
      handleNewProject,
      handleOpenProject,
      handlePackArtcade,
      handleSaveProject,
      handleSaveProjectAs,
      handleSaveScript,
      projectDirty,
    ],
  )

  return { fileItems }
}
