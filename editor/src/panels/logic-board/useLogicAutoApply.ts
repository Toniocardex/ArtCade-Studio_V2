// ---------------------------------------------------------------------------
// useLogicAutoApply — debounced auto-sync of compiled Logic Board Lua to the
// idle preview runtime.
//
// Safety contract (see auto-apply-status.ts for the pure decision):
//  - never fires while the preview is playing (manual Apply handles that,
//    because it restarts the game — a destructive action the user must own)
//  - never fires while main.lua has unsaved manual edits
//  - a failed revision is not retried until the boards change or the user
//    clicks Retry — no silent retry loops
//  - the debounce callback re-validates against fresh store state, so a Play
//    pressed (or an edit made) during the wait window cancels the apply.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useEditorDispatch,
  useEditorSelector,
  useEditorStore,
} from '../../store/editor-store'
import type { compileProjectLogic } from '../../utils/logic-board/logic-compile-service'
import { applyLogicToIdleRuntime } from '../../utils/logic-board/apply-logic'
import {
  resolveLogicSyncStatus,
  shouldAutoApply,
  type AutoApplyInputs,
  type LogicSyncStatus,
} from '../../utils/logic-board/auto-apply-status'
import { logicBoardsRevision } from '../../utils/logic-board-project-flow'
import { composeProjectLua } from '../../utils/project-lua-composer'
import { resolveManualMainLua } from '../../utils/project-main-script'

export const AUTO_APPLY_DEBOUNCE_MS = 700

export interface LogicAutoApply {
  status: LogicSyncStatus
  /** Clear the failed-revision latch and let the debounce re-arm. */
  retrySync: () => void
}

export function useLogicAutoApply(params: {
  compileResult: ReturnType<typeof compileProjectLogic>
  runtimeReady: boolean
  boardsRevision: string
  hasBoards: boolean
}): LogicAutoApply {
  const { compileResult, runtimeReady, boardsRevision, hasBoards } = params
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const isPlaying = useEditorSelector((s) => s.isPlaying)
  const appliedRevision = useEditorSelector((s) => s.logicPreviewAppliedRevision)
  const [failedRevision, setFailedRevision] = useState<string | null>(null)
  const [inFlight, setInFlight] = useState(false)
  const timerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null)

  const inputs: AutoApplyInputs = {
    hasBoards,
    pending: boardsRevision !== '' && appliedRevision !== boardsRevision,
    compileOk: compileResult.ok,
    compileError: compileResult.compileError,
    runtimeReady,
    isPlaying,
    applyInFlight: inFlight,
    failedRevision,
    currentRevision: boardsRevision,
  }
  const armed = shouldAutoApply(inputs)

  useEffect(() => {
    if (!armed) return
    const revisionAtArm = boardsRevision
    const generatedLua = compileResult.lua
    timerRef.current = globalThis.setTimeout(() => {
      timerRef.current = null
      // Re-validate against fresh state: the world may have changed while
      // the debounce was pending (new edit, Play pressed, main.lua dirtied).
      const state = store.getState()
      if (logicBoardsRevision(state.project) !== revisionAtArm) return
      if (state.isPlaying) return
      if (!state.project) return
      const lua = composeProjectLua({
        manualLua: resolveManualMainLua(state.project, state.openScripts),
        generatedLua,
        projectKey: state.projectPath,
      }).combinedLua
      setInFlight(true)
      const outcome = applyLogicToIdleRuntime({
        lua,
        dialogs: state.dialogs,
        dispatch,
      })
      setInFlight(false)
      if (outcome === 'applied') {
        dispatch({ type: 'LOGIC_MARK_PREVIEW_APPLIED', revision: revisionAtArm })
      } else if (outcome === 'failed') {
        setFailedRevision(revisionAtArm)
      }
      // 'not_ready': leave the revision pending — the effect re-arms when
      // runtimeReady flips to true, with a fresh debounce.
    }, AUTO_APPLY_DEBOUNCE_MS)
    return () => {
      if (timerRef.current != null) {
        globalThis.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [armed, boardsRevision, compileResult, store, dispatch])

  const retrySync = useCallback(() => setFailedRevision(null), [])

  return { status: resolveLogicSyncStatus(inputs), retrySync }
}
