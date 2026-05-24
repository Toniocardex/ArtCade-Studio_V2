// ---------------------------------------------------------------------------
// useProjectShortcuts — Ctrl+S / Ctrl+Shift+S / Ctrl+N / Ctrl+O
// ---------------------------------------------------------------------------
//
// Extracted from App.tsx (TECHNICAL_DEBT_REVIEW §16). Owns the "project /
// script lifecycle" shortcuts; viewport zoom shortcuts live in
// useViewportShortcuts so their dep arrays don't cross-contaminate.

import { useEffect } from 'react'
import { useEditor } from '../store/editor-store'
import {
  openProjectDialog, loadProjectFile, saveProjectFile, saveScript,
  saveProjectAsDialog, scaffoldNewProjectOnDisk,
} from '../utils/api'
import { createBlankProject, BLANK_MAIN_LUA } from '../utils/project'
import { runtimeSync } from '../utils/runtime-sync-service'
import type { ConsoleEntry } from '../types'

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

export function useProjectShortcuts(): void {
  const { state, dispatch } = useEditor()

  useEffect(() => {
    function confirmDirty(actionLabel: string): boolean {
      if (!state.projectDirty) return true
      return window.confirm(
        `You have unsaved changes in "${state.project?.projectName ?? 'this project'}".\n` +
        `${actionLabel} will discard them. Continue?`
      )
    }

    async function saveProjectAsFlow(): Promise<void> {
      if (!state.project) return
      const target = await saveProjectAsDialog()
      if (!target) return
      try {
        await scaffoldNewProjectOnDisk(target, state.project, BLANK_MAIN_LUA)
        dispatch({ type: 'LOAD_PROJECT', project: state.project, path: target })
        dispatch({ type: 'MARK_PROJECT_SAVED' })
        dispatch({ type: 'LOG', entry: kbdLog(`OK saved project to ${target}`, 'info') })
      } catch (err) {
        dispatch({ type: 'LOG', entry: kbdLog(`Save As failed: ${err}`, 'error') })
      }
    }

    async function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey) return

      // Ctrl+Shift+S — Save Project As… (checked before Ctrl+S so the shift
      // modifier is not consumed by the plain Save handler below).
      if (e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        await saveProjectAsFlow()
        return
      }

      // Ctrl+S — save active script (script mode) or project (canvas mode)
      if (!e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        if (state.mode === 'canvas') {
          if (!state.project) return
          if (!state.projectPath) {
            await saveProjectAsFlow()
            return
          }
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
          dispatch({ type: 'LOG', entry: kbdLog(`OK saved "${script.path}"`, 'info') })
        } catch (err) {
          dispatch({ type: 'LOG', entry: kbdLog(`Save failed: ${err}`, 'error') })
        }
        return
      }

      // Ctrl+N — new blank project (in-memory only)
      if (!e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        if (!confirmDirty('Creating a new project')) return
        const blank = createBlankProject('Untitled')
        runtimeSync.reset()
        dispatch({ type: 'LOAD_PROJECT', project: blank, path: '' })
        dispatch({ type: 'LOG', entry: kbdLog('OK new blank project (unsaved - use Ctrl+Shift+S).', 'info') })
        return
      }

      // Ctrl+O — open project from disk
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        if (!confirmDirty('Opening a different project')) return
        const path = await openProjectDialog()
        if (!path) return
        dispatch({ type: 'LOG', entry: kbdLog(`Opening ${path}…`, 'info') })
        const proj = await loadProjectFile(path)
        if (!proj) {
          dispatch({ type: 'LOG', entry: kbdLog('Failed to parse project.json', 'error') })
          return
        }
        runtimeSync.reset()
        dispatch({ type: 'LOAD_PROJECT', project: proj, path })
        dispatch({ type: 'LOG', entry: kbdLog(`OK loaded "${proj.projectName}" v${proj.version}`, 'info') })
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    state.openScripts, state.activeScriptPath,
    state.project, state.projectPath, state.projectDirty, state.mode,
    dispatch,
  ])
}
