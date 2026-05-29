import { describe, it, expect } from 'vitest'
import { shouldShowBootLoadingStatus, shouldStartBootFade } from './boot-gate-logic'

describe('shouldStartBootFade', () => {
  it('is false until runtime ready and intro finished', () => {
    expect(shouldStartBootFade({
      ready: false, introDone: true, bootComplete: false, fadeOut: false,
    })).toBe(false)
    expect(shouldStartBootFade({
      ready: true, introDone: false, bootComplete: false, fadeOut: false,
    })).toBe(false)
  })

  it('is true when ready, intro done, and overlay still active', () => {
    expect(shouldStartBootFade({
      ready: true, introDone: true, bootComplete: false, fadeOut: false,
    })).toBe(true)
  })

  it('is false after fade started or boot complete', () => {
    expect(shouldStartBootFade({
      ready: true, introDone: true, bootComplete: true, fadeOut: false,
    })).toBe(false)
    expect(shouldStartBootFade({
      ready: true, introDone: true, bootComplete: false, fadeOut: true,
    })).toBe(false)
  })
})

describe('shouldShowBootLoadingStatus', () => {
  it('shows status after skip while engine still loading', () => {
    expect(shouldShowBootLoadingStatus({
      introDone: true, ready: false, timedOut: false,
    })).toBe(true)
  })

  it('hides status when ready or timed out', () => {
    expect(shouldShowBootLoadingStatus({
      introDone: true, ready: true, timedOut: false,
    })).toBe(false)
    expect(shouldShowBootLoadingStatus({
      introDone: true, ready: false, timedOut: true,
    })).toBe(false)
  })
})
