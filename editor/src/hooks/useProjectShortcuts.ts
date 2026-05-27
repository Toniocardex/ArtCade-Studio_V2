// ---------------------------------------------------------------------------
// useProjectShortcuts — Ctrl+S / Ctrl+Shift+S / Ctrl+N / Ctrl+O
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useEditor } from '../store/editor-store'
import {
  openProjectDialog,
  loadProjectFromPath,
  saveScript,
  saveProjectAsDialog,
  scaffoldNewProjectOnDisk,
  resolveScriptPath,
} from '../utils/api'
import { createBlankProject } from '../utils/project'
import { runtimeSync } from '../utils/runtime-sync-service'
import type { ConsoleEntry } from '../types'
import { useProjectNamePersist } from '../components/menu-bar/project-name-context'
import { ensureProjectOnDisk } from '../components/menu-bar/ensureProjectOnDisk'
import { mainScriptBodyForProject } from '../components/menu-bar/project-script'

let _kbdLogId = 500
function kbdLog(message: string, level: ConsoleEntry['level']): ConsoleEntry {
  const now = new Date()
  return {
    id: ++_kbdLogId,
    time: now.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    message,
    level,
  }
}

export function useProjectShortcuts(): void {
  const { state, dispatch } = useEditor()
  const { flushBeforePersist } = useProjectNamePersist()

  useEffect(() => {
    function confirmDirty(actionLabel: string): boolean {
      if (!state.projectDirty) return true
      return window.confirm(
        `You have unsaved changes in "${state.project?.projectName ?? 'this project'}".\n` +
          `${actionLabel} will discard them. Continue?`,
      )
    }

    async function saveProjectAsFlow(): Promise<void> {
      const flushed = flushBeforePersist()
      if (!flushed) return
      const target = await saveProjectAsDialog(flushed.projectName)
      if (!target) return
      try {
        const projectJsonPath = await scaffoldNewProjectOnDisk(
          target,
          flushed,
          mainScriptBodyForProject(flushed, state.projectPath),
        )
        dispatch({ type: 'LOAD_PROJECT', project: flushed, path: projectJsonPath })
        dispatch({ type: 'MARK_PROJECT_SAVED' })
        dispatch({ type: 'LOG', entry: kbdLog(`OK saved project to ${projectJsonPath}`, 'info') })
      } catch (err) {
        dispatch({ type: 'LOG', entry: kbdLog(`Save As failed: ${err}`, 'error') })
      }
    }

    async function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey) return

      if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        await saveProjectAsFlow()
        return
      }

      if (!e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        if (state.mode === 'canvas') {
          const flushed = flushBeforePersist()
          if (!flushed) return
          if (!state.projectPath) {
            await saveProjectAsFlow()
            return
          }
          const savedPath = await ensureProjectOnDisk({
            kind: 'save',
            dispatch,
            project: flushed,
            projectPath: state.projectPath,
          })
          if (savedPath) {
            dispatch({
              type: 'LOG',
              entry: kbdLog(`Saved project "${flushed.projectName}"`, 'info'),
            })
          }
          return
        }

        const script = state.openScripts.find((s) => s.path === state.activeScriptPath)
        if (!script) return
        if (!script.isDirty) {
          dispatch({ type: 'LOG', entry: kbdLog(`"${script.path}" already saved.`, 'info') })
          return
        }
        try {
          const absPath = resolveScriptPath(state.projectPath, script.path)
          await saveScript(absPath, script.content)
          dispatch({ type: 'MARK_SCRIPT_SAVED', path: script.path })
          dispatch({ type: 'LOG', entry: kbdLog(`OK saved "${script.path}"`, 'info') })
        } catch (err) {
          dispatch({ type: 'LOG', entry: kbdLog(`Save failed: ${err}`, 'error') })
        }
        return
      }

      if (!e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        if (!confirmDirty('Creating a new project')) return
        const blank = createBlankProject('Untitled')
        runtimeSync.reset()
        dispatch({ type: 'LOAD_PROJECT', project: blank, path: '' })
        dispatch({
          type: 'LOG',
          entry: kbdLog('OK new blank project (unsaved - use Ctrl+Shift+S).', 'info'),
        })
        return
      }

      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        if (!confirmDirty('Opening a different project')) return
        const path = await openProjectDialog()
        if (!path) return
        dispatch({ type: 'LOG', entry: kbdLog(`Opening ${path}…`, 'info') })
        const loaded = await loadProjectFromPath(path)
        if (!loaded) {
          dispatch({ type: 'LOG', entry: kbdLog('Failed to open project', 'error') })
          return
        }
        runtimeSync.reset()
        dispatch({
          type: 'LOAD_PROJECT',
          project: loaded.project,
          path: loaded.path,
          migratedFromLegacy: loaded.migratedFromLegacy,
        })
        dispatch({
          type: 'LOG',
          entry: kbdLog(`OK loaded "${loaded.project.projectName}" v${loaded.project.version}`, 'info'),
        })
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    state.openScripts,
    state.activeScriptPath,
    state.project,
    state.projectPath,
    state.projectDirty,
    state.mode,
    dispatch,
    flushBeforePersist,
  ])
}
