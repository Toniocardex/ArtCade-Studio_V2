// ---------------------------------------------------------------------------
// Apply compiled Logic Board Lua to the preview runtime.
//
// Two entry points:
//  - applyLogicToIdleRuntime: silent, non-destructive hot-reload used by the
//    auto-apply hook (and the failed-sync Retry). Never touches play mode.
//  - executeApplyLogic: full manual apply — also handles the destructive
//    "reset play mode" branch and flashes user-facing messages.
// ---------------------------------------------------------------------------

import type { Dispatch } from 'react'
import type { Action, CoreState } from '../../store/editor-store'
import type { ProjectDoc } from '../../types'
import type { compileProjectLogic } from './logic-compile-service'
import { runtimeSync } from '../runtime-sync-service'
import { makeConsoleEntry } from '../../components/menu-bar/makeConsoleEntry'
import { syncLogicBoardToScript } from '../sync-logic-board-script'

type EditorDispatch = Dispatch<Action>
type CompileResult = ReturnType<typeof compileProjectLogic>

export type IdleApplyOutcome = 'applied' | 'not_ready' | 'failed'

/**
 * Push compiled Lua to the idle (non-playing) runtime. Quiet on success —
 * the sync chip is the feedback; failures land in the console.
 */
export function applyLogicToIdleRuntime(params: {
  lua: string
  dialogs: CoreState['dialogs']
  dispatch: EditorDispatch
}): IdleApplyOutcome {
  runtimeSync.syncDialogs(params.dialogs)
  const result = runtimeSync.applyMainLua(params.lua)
  switch (result.status) {
    case 'reloaded':
    case 'unchanged':
      return 'applied'
    case 'not_ready':
      return 'not_ready'
    case 'failed':
      params.dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(
          `[Logic] Auto-sync failed: ${result.message ?? 'script hot-reload failed.'}`,
          'error',
        ),
      })
      return 'failed'
  }
}

export type ApplyLogicParams = Readonly<{
  compileResult: CompileResult
  runtimeReady: boolean
  state: CoreState
  project: ProjectDoc
  selectionSceneId: string | undefined
  dispatch: EditorDispatch
  flashApplyMsg: (msg: string, ms?: number) => void
}>

/** Manual apply — including the play-mode branch that resets the preview. */
export function executeApplyLogic({
  compileResult,
  runtimeReady,
  state,
  project,
  selectionSceneId,
  dispatch,
  flashApplyMsg,
}: ApplyLogicParams): boolean {
  if (!compileResult.ok) {
    flashApplyMsg('Fix Logic Board compile errors before applying.', 5000)
    return false
  }
  syncLogicBoardToScript(dispatch, state, compileResult.lua)
  if (!runtimeReady) {
    flashApplyMsg('Runtime still loading — try again in a moment.')
    return false
  }
  if (state.isPlaying) {
    const activeSceneId = selectionSceneId ?? project.activeSceneId
    const outcome = runtimeSync.transitionPreview('stop', {
      project,
      activeSceneId,
      mainLua: compileResult.lua,
      dialogs: state.dialogs,
      projectPath: state.projectPath,
    })
    if (outcome.nextPlaying !== state.isPlaying) {
      dispatch({ type: 'SET_PLAYING', playing: outcome.nextPlaying })
    }
    if (!outcome.ok) {
      flashApplyMsg('Failed to reset preview — see console.')
      dispatch({
        type: 'LOG',
        entry: makeConsoleEntry(
          '[Logic] Apply failed while exiting play mode (runtime not ready or script reload failed).',
          'error',
        ),
      })
      return false
    }
    flashApplyMsg('Logic applied — preview reset to design state')
    return true
  }
  const outcome = applyLogicToIdleRuntime({
    lua: compileResult.lua,
    dialogs: state.dialogs,
    dispatch,
  })
  if (outcome === 'applied') return true
  if (outcome === 'not_ready') {
    flashApplyMsg('Runtime still loading — try again in a moment.')
  } else {
    flashApplyMsg('Failed to apply logic — see console.')
  }
  return false
}
