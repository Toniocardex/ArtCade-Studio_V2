import { describe, it, expect } from 'vitest'
import {
  resolveLogicSyncStatus,
  shouldAutoApply,
  type AutoApplyInputs,
} from './auto-apply-status'

function inputs(overrides: Partial<AutoApplyInputs> = {}): AutoApplyInputs {
  return {
    hasBoards: true,
    pending: true,
    compileOk: true,
    compileError: null,
    runtimeReady: true,
    isPlaying: false,
    applyInFlight: false,
    failedRevision: null,
    currentRevision: 'rev1',
    ...overrides,
  }
}

describe('shouldAutoApply', () => {
  it('fires only when pending, compiled, runtime ready and idle', () => {
    expect(shouldAutoApply(inputs())).toBe(true)
  })

  it('never fires during play (manual apply owns the destructive path)', () => {
    expect(shouldAutoApply(inputs({ isPlaying: true }))).toBe(false)
  })

  it('never fires on compile errors or before the runtime is ready', () => {
    expect(shouldAutoApply(inputs({ compileOk: false }))).toBe(false)
    expect(shouldAutoApply(inputs({ runtimeReady: false }))).toBe(false)
  })

  it('does not retry a revision that already failed', () => {
    expect(shouldAutoApply(inputs({ failedRevision: 'rev1' }))).toBe(false)
    expect(
      shouldAutoApply(inputs({ failedRevision: 'rev0', currentRevision: 'rev1' })),
    ).toBe(true)
  })

  it('is a no-op without boards or pending changes', () => {
    expect(shouldAutoApply(inputs({ hasBoards: false }))).toBe(false)
    expect(shouldAutoApply(inputs({ pending: false }))).toBe(false)
  })
})

describe('resolveLogicSyncStatus', () => {
  it('reports synced when nothing is pending', () => {
    expect(resolveLogicSyncStatus(inputs({ pending: false })).kind).toBe('synced')
  })

  it('reports syncing while pending and safe', () => {
    expect(resolveLogicSyncStatus(inputs()).kind).toBe('syncing')
    expect(resolveLogicSyncStatus(inputs({ applyInFlight: true })).kind).toBe('syncing')
  })

  it('compile errors win over every pending state', () => {
    const s = resolveLogicSyncStatus(
      inputs({ compileOk: false, compileError: 'boom' }),
    )
    expect(s.kind).toBe('compile-error')
    expect(s.detail).toBe('boom')
  })

  it('reports the manual-apply path while playing', () => {
    expect(resolveLogicSyncStatus(inputs({ isPlaying: true })).kind).toBe(
      'play-pending',
    )
  })

  it('reports waiting while the runtime loads', () => {
    expect(resolveLogicSyncStatus(inputs({ runtimeReady: false })).kind).toBe(
      'runtime-loading',
    )
  })

  it('latches failed for the failed revision only', () => {
    expect(resolveLogicSyncStatus(inputs({ failedRevision: 'rev1' })).kind).toBe(
      'failed',
    )
    expect(
      resolveLogicSyncStatus(
        inputs({ failedRevision: 'rev0', currentRevision: 'rev1' }),
      ).kind,
    ).toBe('syncing')
  })

  it('reports no-board for empty projects', () => {
    expect(resolveLogicSyncStatus(inputs({ hasBoards: false })).kind).toBe(
      'no-board',
    )
  })
})
