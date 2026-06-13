export type LogicSyncStatusKind =
  | 'no-board'
  | 'synced'
  | 'syncing'
  | 'compile-error'
  | 'runtime-loading'
  | 'play-pending'
  | 'failed'

export interface LogicSyncStatus {
  kind: LogicSyncStatusKind
  detail?: string
}

export interface AutoApplyInputs {
  hasBoards: boolean
  pending: boolean
  compileOk: boolean
  compileError?: string | null
  runtimeReady: boolean
  isPlaying: boolean
  applyInFlight: boolean
  failedRevision: string | null
  currentRevision: string
}

export function shouldAutoApply(input: AutoApplyInputs): boolean {
  return (
    input.hasBoards &&
    input.pending &&
    input.compileOk &&
    input.runtimeReady &&
    !input.isPlaying &&
    input.failedRevision !== input.currentRevision
  )
}

export function resolveLogicSyncStatus(input: AutoApplyInputs): LogicSyncStatus {
  if (!input.hasBoards) return { kind: 'no-board' }
  if (!input.compileOk) {
    return { kind: 'compile-error', detail: input.compileError ?? undefined }
  }
  if (!input.pending) return { kind: 'synced' }
  if (input.failedRevision === input.currentRevision) {
    return {
      kind: 'failed',
      detail: 'Hot-reload failed - see console. Edit the board or retry.',
    }
  }
  if (input.isPlaying) return { kind: 'play-pending' }
  if (!input.runtimeReady) return { kind: 'runtime-loading' }
  return { kind: 'syncing' }
}
