// ---------------------------------------------------------------------------
// useProjectShortcuts — Ctrl+S / Ctrl+Shift+S / Ctrl+N / Ctrl+O
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useEditor } from '../store/editor-store'
import type { Dispatch } from 'react'
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
import type { ConsoleEntry, ProjectDoc } from '../types'
import type { Action as EditorAction, CoreState } from '../store/editor-store'
import { useProjectNamePersist } from '../components/menu-bar/project-name-context'
import { ensureProjectOnDisk } from '../components/menu-bar/ensureProjectOnDisk'
import { mainScriptBodyForProject } from '../components/menu-bar/project-script'
import { loadDialogsFromProject, starterInnkeeperScript } from '../utils/dialog/dialog-file-api'

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

function isSaveKey(key: string): boolean {
  return key === 's' || key === 'S'
}

type ShortcutCtx = Readonly<{
  state: CoreState
  dispatch: Dispatch<EditorAction>
  flushBeforePersist: () => ProjectDoc | null
}>

function confirmDirty(state: CoreState, actionLabel: string): boolean {
  if (!state.projectDirty) return true
  return globalThis.confirm(
    `You have unsaved changes in "${state.project?.projectName ?? 'this project'}".\n` +
      `${actionLabel} will discard them. Continue?`,
  )
}

async function saveProjectAsFlow(ctx: ShortcutCtx): Promise<void> {
  const flushed = ctx.flushBeforePersist()
  if (!flushed) return
  const target = await saveProjectAsDialog(flushed.projectName)
  if (!target) return
  try {
    const projectJsonPath = await scaffoldNewProjectOnDisk(
      target,
      flushed,
      mainScriptBodyForProject(flushed, ctx.state.projectPath),
    )
    ctx.dispatch({ type: 'LOAD_PROJECT', project: flushed, path: projectJsonPath })
    ctx.dispatch({ type: 'MARK_PROJECT_SAVED' })
    ctx.dispatch({
      type: 'LOG',
      entry: kbdLog(`OK saved project to ${projectJsonPath}`, 'info'),
    })
  } catch (err) {
    ctx.dispatch({ type: 'LOG', entry: kbdLog(`Save As failed: ${err}`, 'error') })
  }
}

async function handleCtrlSave(ctx: ShortcutCtx): Promise<void> {
  if (ctx.state.mode === 'canvas') {
    const flushed = ctx.flushBeforePersist()
    if (!flushed) return
    if (!ctx.state.projectPath) {
      await saveProjectAsFlow(ctx)
      return
    }
    const savedPath = await ensureProjectOnDisk({
      kind: 'save',
      dispatch: ctx.dispatch,
      project: flushed,
      projectPath: ctx.state.projectPath,
      dialogs: ctx.state.dialogs,
    })
    if (savedPath) {
      ctx.dispatch({
        type: 'LOG',
        entry: kbdLog(`Saved project "${flushed.projectName}"`, 'info'),
      })
    }
    return
  }

  const script = ctx.state.openScripts.find((s) => s.path === ctx.state.activeScriptPath)
  if (!script) return
  if (!script.isDirty) {
    ctx.dispatch({
      type: 'LOG',
      entry: kbdLog(`"${script.path}" already saved.`, 'info'),
    })
    return
  }
  try {
    const absPath = resolveScriptPath(ctx.state.projectPath, script.path)
    await saveScript(absPath, script.content)
    ctx.dispatch({ type: 'MARK_SCRIPT_SAVED', path: script.path })
    ctx.dispatch({ type: 'LOG', entry: kbdLog(`OK saved "${script.path}"`, 'info') })
  } catch (err) {
    ctx.dispatch({ type: 'LOG', entry: kbdLog(`Save failed: ${err}`, 'error') })
  }
}

function handleCtrlNew(ctx: ShortcutCtx): void {
  if (!confirmDirty(ctx.state, 'Creating a new project')) return
  const blank = createBlankProject('Untitled')
  runtimeSync.reset()
  const starter = { innkeeper: starterInnkeeperScript() }
  ctx.dispatch({
    type: 'LOAD_PROJECT',
    project: blank,
    path: '',
    dialogs: starter,
    selectedDialogId: 'innkeeper',
  })
  ctx.dispatch({
    type: 'LOG',
    entry: kbdLog('OK new blank project (unsaved - use Ctrl+Shift+S).', 'info'),
  })
}

async function handleCtrlOpen(ctx: ShortcutCtx): Promise<void> {
  if (!confirmDirty(ctx.state, 'Opening a different project')) return
  const path = await openProjectDialog()
  if (!path) return
  ctx.dispatch({ type: 'LOG', entry: kbdLog(`Opening ${path}…`, 'info') })
  const loaded = await loadProjectFromPath(path)
  if (!loaded) {
    ctx.dispatch({ type: 'LOG', entry: kbdLog('Failed to open project', 'error') })
    return
  }
  runtimeSync.reset()
  const loadedDialogs = await loadDialogsFromProject(loaded.path)
  const dialogIds = Object.keys(loadedDialogs).sort((a, b) => a.localeCompare(b))
  ctx.dispatch({
    type: 'LOAD_PROJECT',
    project: loaded.project,
    path: loaded.path,
    migratedFromLegacy: loaded.migratedFromLegacy,
    dialogs: loadedDialogs,
    selectedDialogId: dialogIds[0] ?? null,
  })
  ctx.dispatch({
    type: 'LOG',
    entry: kbdLog(`OK loaded "${loaded.project.projectName}" v${loaded.project.version}`, 'info'),
  })
}

async function handleKeyDown(ctx: ShortcutCtx, e: KeyboardEvent): Promise<void> {
  if (!e.ctrlKey) return

  if (e.shiftKey && isSaveKey(e.key)) {
    e.preventDefault()
    await saveProjectAsFlow(ctx)
    return
  }

  if (!e.shiftKey && isSaveKey(e.key)) {
    e.preventDefault()
    await handleCtrlSave(ctx)
    return
  }

  if (!e.shiftKey && (e.key === 'n' || e.key === 'N')) {
    e.preventDefault()
    handleCtrlNew(ctx)
    return
  }

  if (e.key === 'o' || e.key === 'O') {
    e.preventDefault()
    await handleCtrlOpen(ctx)
  }
}

export function useProjectShortcuts(): void {
  const { state, dispatch } = useEditor()
  const { flushBeforePersist } = useProjectNamePersist()

  useEffect(() => {
    const ctx: ShortcutCtx = { state, dispatch, flushBeforePersist }
    const onKeyDown = (e: KeyboardEvent) => {
      void handleKeyDown(ctx, e)
    }
    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [
    state.openScripts,
    state.activeScriptPath,
    state.project,
    state.projectPath,
    state.projectDirty,
    state.mode,
    state.dialogs,
    dispatch,
    flushBeforePersist,
  ])
}
