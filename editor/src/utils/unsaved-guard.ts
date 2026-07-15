/**
 * Unsaved authoring guard — Save All / Discard / Cancel.
 * Covers ProjectDocument dirt and dirty script buffers (workspace).
 */

import type { Dispatch } from 'react'
import type { Action, CoreState } from '../store/editor-store-state'
import type { ProjectDoc, ScriptFile } from '../types'
import type { DialogScript } from './dialog/dialog-script'
import { resolveScriptPath, saveScript } from './api'
import { requestChoicePrompt } from './choice-prompt'
import { ensureProjectOnDisk } from '../components/menu-bar/ensureProjectOnDisk'
import { makeConsoleEntry } from '../components/menu-bar/makeConsoleEntry'

export type UnsavedGuardChoice = 'save' | 'discard' | 'cancel'

export type UnsavedAuthoringSlice = Readonly<{
  projectDirty: boolean
  openScripts: readonly ScriptFile[]
  projectName?: string | null
}>

/**
 * True when project or any open script buffer has unsaved authoring changes.
 */
export function hasUnsavedAuthoring(state: UnsavedAuthoringSlice): boolean {
  if (state.projectDirty) return true
  return state.openScripts.some((script) => script.isDirty)
}

/**
 * Prompt Save All / Discard / Cancel. Returns cancel when the user dismisses.
 */
export async function confirmUnsavedGuard(params: Readonly<{
  projectName: string
  actionLabel: string
}>): Promise<UnsavedGuardChoice> {
  const choice = await requestChoicePrompt({
    title: 'Unsaved changes',
    message:
      `You have unsaved changes in "${params.projectName}".\n` +
      `${params.actionLabel}\n\n` +
      'Save All keeps project and script buffers. Discard loses them. Cancel aborts.',
    cancelId: 'cancel',
    choices: [
      { id: 'cancel', label: 'Cancel', kind: 'default' },
      { id: 'discard', label: 'Discard', kind: 'danger' },
      { id: 'save', label: 'Save All', kind: 'primary' },
    ],
  })
  if (choice === 'save' || choice === 'discard' || choice === 'cancel') return choice
  return 'cancel'
}

/**
 * Runs the three-way guard. On Save All, persists project + dirty scripts.
 * @returns true when the destructive action may proceed
 */
export async function resolveUnsavedGuard(params: Readonly<{
  state: Pick<CoreState, 'project' | 'projectPath' | 'projectDirty' | 'openScripts' | 'dialogs'>
  actionLabel: string
  dispatch: Dispatch<Action>
  flushBeforePersist: () => ProjectDoc | null
}>): Promise<boolean> {
  const { state, actionLabel, dispatch, flushBeforePersist } = params
  if (!hasUnsavedAuthoring(state)) return true

  const choice = await confirmUnsavedGuard({
    projectName: state.project?.projectName ?? 'this project',
    actionLabel,
  })
  if (choice === 'cancel') return false
  if (choice === 'discard') return true

  const saved = await saveAllAuthoring({
    dispatch,
    flushBeforePersist,
    projectPath: state.projectPath,
    dialogs: state.dialogs,
    openScripts: state.openScripts,
  })
  return saved
}

/**
 * Persists ProjectDocument (+ dialogs) and every dirty open script buffer.
 * Failed save returns false so the caller can abort the destructive op.
 */
export async function saveAllAuthoring(params: Readonly<{
  dispatch: Dispatch<Action>
  flushBeforePersist: () => ProjectDoc | null
  projectPath: string | null
  dialogs: Record<string, DialogScript>
  openScripts: readonly ScriptFile[]
}>): Promise<boolean> {
  const { dispatch, flushBeforePersist, projectPath, dialogs, openScripts } = params
  const flushed = flushBeforePersist()
  if (!flushed) {
    dispatch({
      type: 'LOG',
      entry: makeConsoleEntry('[File] Save All failed: no project loaded.', 'error'),
    })
    return false
  }

  const savedPath = await ensureProjectOnDisk({
    kind: 'save',
    dispatch,
    project: flushed,
    projectPath,
    dialogs,
    openScripts: [...openScripts],
  })
  if (!savedPath) return false

  const dirtyScripts = openScripts.filter(
    (script) => script.isDirty && script.path !== flushed.mainScriptPath,
  )
  for (const script of dirtyScripts) {
    try {
      const absPath = resolveScriptPath(savedPath, script.path)
      await saveScript(absPath, script.content, savedPath)
      dispatch({ type: 'MARK_SCRIPT_SAVED', path: script.path })
    } catch (err) {
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(`[File] Save All failed for "${script.path}": ${err}`, 'error'),
      })
      return false
    }
  }

  dispatch({
    type: 'LOG',
    entry: makeConsoleEntry('[File] Save All completed.', 'info'),
  })
  return true
}
