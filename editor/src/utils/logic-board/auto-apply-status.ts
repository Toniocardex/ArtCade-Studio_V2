// ---------------------------------------------------------------------------
// Auto-apply decision model — pure, testable.
//
// The Logic Board syncs compiled Lua to the preview runtime automatically
// (debounced) whenever it is safe and non-destructive. This module owns the
// "is it safe?" decision and the user-facing status, so the hook stays a
// thin timer and the UI a thin renderer.
// ---------------------------------------------------------------------------

export type LogicSyncStatusKind =
  | 'no-board'
  | 'synced'
  | 'syncing'
  | 'compile-error'
  | 'runtime-loading'
  | 'play-pending'
  | 'paused-dirty-main'
  | 'failed'

export interface LogicSyncStatus {
  kind: LogicSyncStatusKind
  /** Extra context for tooltips (compile error summary, failure hint). */
  detail?: string
}

export interface AutoApplyInputs {
  hasBoards: boolean
  /** Current boards revision differs from the one applied to the runtime. */
  pending: boolean
  compileOk: boolean
  compileError?: string | null
  runtimeReady: boolean
  isPlaying: boolean
  /** main.lua buffer has unsaved manual edits — board sync must not clobber. */
  mainScriptDirty: boolean
  /** Debounce timer armed or apply in flight. */
  applyInFlight: boolean
  /** Last revision whose auto-apply failed; do not retry until it changes. */
  failedRevision: string | null
  currentRevision: string
}

/** True when the hook should arm/keep the debounce timer for this revision. */
export function shouldAutoApply(i: AutoApplyInputs): boolean {
  return (
    i.hasBoards &&
    i.pending &&
    i.compileOk &&
    i.runtimeReady &&
    !i.isPlaying &&
    !i.mainScriptDirty &&
    i.failedRevision !== i.currentRevision
  )
}

/** User-facing sync status for the header chip. */
export function resolveLogicSyncStatus(i: AutoApplyInputs): LogicSyncStatus {
  if (!i.hasBoards) return { kind: 'no-board' }
  if (!i.compileOk) {
    return { kind: 'compile-error', detail: i.compileError ?? undefined }
  }
  if (!i.pending) return { kind: 'synced' }
  if (i.failedRevision === i.currentRevision) {
    return {
      kind: 'failed',
      detail: 'Hot-reload failed — see console. Edit the board or retry.',
    }
  }
  if (i.isPlaying) return { kind: 'play-pending' }
  if (i.mainScriptDirty) {
    return {
      kind: 'paused-dirty-main',
      detail:
        'main.lua has unsaved manual edits — board sync is paused so they are not overwritten.',
    }
  }
  if (!i.runtimeReady) return { kind: 'runtime-loading' }
  if (i.applyInFlight) return { kind: 'syncing' }
  // Pending and safe: the debounce timer is about to pick it up.
  return { kind: 'syncing' }
}
