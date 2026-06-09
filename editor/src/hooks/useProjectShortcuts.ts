// ---------------------------------------------------------------------------
// useProjectShortcuts — Ctrl+S / Ctrl+Shift+S / Ctrl+N / Ctrl+O
// ---------------------------------------------------------------------------

import { useEffect } from 'react'
import { useEditorDispatch, useEditorStore } from '../store/editor-store'
import type { Dispatch } from 'react'
import { dispatchLogicBoardLoadWarnings } from '../utils/logic-board/logic-board-load-warnings'
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
import { confirmDialog } from '../utils/native-dialog'

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

async function confirmDirty(state: CoreState, actionLabel: string): Promise<boolean> {
  if (!state.projectDirty) return true
  return confirmDialog(
    `You have unsaved changes in "${state.project?.projectName ?? 'this project'}".\n` +
      `${actionLabel} will discard them. Continue?`,
    { title: 'Unsaved changes', kind: 'warning' },
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
    if (!ctx.state.projectPath) return
    const absPath = resolveScriptPath(ctx.state.projectPath, script.path)
    await saveScript(absPath, script.content, ctx.state.projectPath)
    ctx.dispatch({ type: 'MARK_SCRIPT_SAVED', path: script.path })
    ctx.dispatch({ type: 'LOG', entry: kbdLog(`OK saved "${script.path}"`, 'info') })
  } catch (err) {
    ctx.dispatch({ type: 'LOG', entry: kbdLog(`Save failed: ${err}`, 'error') })
  }
}

async function handleCtrlNew(ctx: ShortcutCtx): Promise<void> {
  if (!(await confirmDirty(ctx.state, 'Creating a new project'))) return
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
  if (!(await confirmDirty(ctx.state, 'Opening a different project'))) return
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
  dispatchLogicBoardLoadWarnings(ctx.dispatch, loaded.logicBoardLoadIssues, kbdLog)
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
    await handleCtrlNew(ctx)
    return
  }

  if (e.key === 'o' || e.key === 'O') {
    e.preventDefault()
    await handleCtrlOpen(ctx)
  }
}

export function useProjectShortcuts(): void {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const { flushBeforePersist } = useProjectNamePersist()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      void handleKeyDown({ state: store.getState(), dispatch, flushBeforePersist }, e)
    }
    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [store, dispatch, flushBeforePersist])
}
