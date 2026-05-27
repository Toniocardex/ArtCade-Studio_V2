import { useCallback, useMemo } from 'react'
import type { Dispatch } from 'react'
import { FilePlus, FolderOpen, Save, Package, Hammer } from 'lucide-react'
import type { Action as EditorAction, CoreState } from '../../store/editor-store'
import {
  openProjectDialog,
  loadProjectFromPath,
  saveScript,
  savePackDialog,
  packProject,
  saveProjectAsDialog,
  scaffoldNewProjectOnDisk,
  resolveScriptPath,
  ensureDependencies,
  checkDependencies,
} from '../../utils/api'
import {
  dirName,
  createProjectFromTemplate,
  PROJECT_TEMPLATE_LABELS,
  type ProjectTemplateId,
} from '../../utils/project'
import { runtimeSync } from '../../utils/runtime-sync-service'
import type { ProjectDoc } from '../../types'
import type { FileMenuItem } from './FileMenu'
import { makeConsoleEntry } from './makeConsoleEntry'
import { mainScriptBodyForProject, mainScriptBodyForProjectWithStatus } from './project-script'
import { ensureProjectOnDisk } from './ensureProjectOnDisk'

interface UseFileMenuActionsParams {
  dispatch: Dispatch<EditorAction>
  project: ProjectDoc | null
  projectPath: string | null
  projectDirty: boolean
  openScripts: CoreState['openScripts']
  activeScriptPath: string | null
  closeMenu: () => void
  flushBeforePersist: () => ProjectDoc | null
}

export function useFileMenuActions({
  dispatch,
  project,
  projectPath,
  projectDirty,
  openScripts,
  activeScriptPath,
  closeMenu,
  flushBeforePersist,
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
    const loaded = await loadProjectFromPath(path)
    if (!loaded) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[File] ✗ Failed to open project', 'error') })
      return
    }
    runtimeSync.reset()
    dispatch({ type: 'LOAD_PROJECT', project: loaded.project, path: loaded.path })
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry(`[File] ✓ Loaded "${loaded.project.projectName}" v${loaded.project.version}`, 'info'),
    })
  }, [closeMenu, confirmDiscardIfDirty, dispatch])

  const loadNewProject = useCallback(
    (template: ProjectTemplateId) => {
      const label = PROJECT_TEMPLATE_LABELS[template]
      const project = createProjectFromTemplate(
        template,
        template === 'blank' ? 'Untitled' : label,
      )
      runtimeSync.reset()
      dispatch({ type: 'LOAD_PROJECT', project, path: '' })
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(
          `[File] OK new ${label} project (unsaved – use Save Project As to persist).`,
          'info',
        ),
      })
    },
    [dispatch],
  )

  const handleNewProject = useCallback(
    async (template: ProjectTemplateId = 'blank') => {
      closeMenu()
      if (!confirmDiscardIfDirty('Creating a new project')) return
      loadNewProject(template)
    },
    [closeMenu, confirmDiscardIfDirty, loadNewProject],
  )

  const handleSaveProjectAs = useCallback(async () => {
    closeMenu()
    const flushed = flushBeforePersist()
    if (!flushed) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[File] No project to save.', 'warn') })
      return
    }
    const target = await saveProjectAsDialog(flushed.projectName)
    if (!target) return
    try {
      const projectJsonPath = await scaffoldNewProjectOnDisk(
        target,
        flushed,
        mainScriptBodyForProject(flushed, projectPath),
      )
      dispatch({ type: 'LOAD_PROJECT', project: flushed, path: projectJsonPath })
      dispatch({ type: 'MARK_PROJECT_SAVED' })
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[File] Saved project to ${projectJsonPath}`, 'info'),
      })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[File] ✗ Save As failed: ${err}`, 'error') })
    }
  }, [closeMenu, dispatch, flushBeforePersist])

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
    const flushed = flushBeforePersist()
    if (!flushed) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[File] No project loaded.', 'warn') })
      return
    }
    if (!projectPath) {
      await handleSaveProjectAs()
      return
    }
    const savedPath = await ensureProjectOnDisk({
      kind: 'save',
      dispatch,
      project: flushed,
      projectPath,
    })
    if (savedPath) {
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[File] Saved project "${flushed.projectName}"`, 'info'),
      })
    }
  }, [closeMenu, dispatch, flushBeforePersist, handleSaveProjectAs, projectPath])

  const handlePackArtcade = useCallback(async () => {
    closeMenu()
    const flushed = flushBeforePersist()
    if (!flushed) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[Pack] No project loaded.', 'warn') })
      return
    }
    if (!projectPath) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[Pack] No project loaded.', 'warn') })
      return
    }
    const output = await savePackDialog()
    if (!output) return
    dispatch({ type: 'SET_CONSOLE_OPEN', open: true })
    if (!(await ensureDependencies('pack'))) return
    const root = dirName(projectPath)

    const mainScriptPath = flushed.mainScriptPath
    if (mainScriptPath && flushed.logicBoards && flushed.logicBoards.length > 0) {
      const { lua, compileError } = mainScriptBodyForProjectWithStatus(flushed, projectPath)
      if (compileError) {
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(
            `[Pack] Logic Board compile failed — using blank main script:\n${compileError}`,
            'error',
          ),
        })
      }
      const absScriptPath = resolveScriptPath(projectPath, mainScriptPath)
      await saveScript(absScriptPath, lua)
      dispatch({
        type: 'UPSERT_SCRIPT',
        path: mainScriptPath,
        content: lua,
        isDirty: false,
        activate: false,
      })
      if (!compileError) {
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(`[Pack] Logic Board compiled → ${mainScriptPath}`, 'info'),
        })
      }
    }

    dispatch({ type: 'LOG', entry: makeConsoleEntry(`[Pack] Packing → ${output}`, 'info') })
    try {
      await packProject(root, output)
      dispatch({ type: 'LOG', entry: makeConsoleEntry('[Pack] ✓ .artcade created.', 'info') })
    } catch (err) {
      dispatch({ type: 'LOG', entry: makeConsoleEntry(`[Pack] ✗ ${err}`, 'error') })
    }
  }, [closeMenu, dispatch, flushBeforePersist, projectPath])

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
        label: 'New Project (Blank)',
        icon: <FilePlus size={12} />,
        shortcut: 'Ctrl+N',
        action: () => handleNewProject('blank'),
      },
      {
        label: 'New Project — Arcade (no physics)',
        icon: <FilePlus size={12} />,
        shortcut: '',
        action: () => handleNewProject('arcade'),
      },
      {
        label: 'New Project — Platformer',
        icon: <FilePlus size={12} />,
        shortcut: '',
        action: () => handleNewProject('platformer'),
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
