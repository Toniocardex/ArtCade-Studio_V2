import { describe, it, expect } from 'vitest'
import {
  SPLASH_MIN_VISIBLE_MS,
  canSkipBootIntro,
  shouldShowBootLoadingStatus,
  shouldStartBootFade,
} from './boot-gate-logic'

describe('shouldStartBootFade', () => {
  const started = 1000

  it('is false until runtime ready and intro finished', () => {
    expect(shouldStartBootFade({
      ready: false,
      introComplete: true,
      bootComplete: false,
      fadeOut: false,
      nowMs: started + SPLASH_MIN_VISIBLE_MS,
      splashStartedAtMs: started,
    })).toBe(false)
    expect(shouldStartBootFade({
      ready: true,
      introComplete: false,
      bootComplete: false,
      fadeOut: false,
      nowMs: started + SPLASH_MIN_VISIBLE_MS,
      splashStartedAtMs: started,
    })).toBe(false)
  })

  it('is false until minimum splash visible time elapses', () => {
    expect(shouldStartBootFade({
      ready: true,
      introComplete: true,
      bootComplete: false,
      fadeOut: false,
      nowMs: started + SPLASH_MIN_VISIBLE_MS - 1,
      splashStartedAtMs: started,
    })).toBe(false)
    expect(shouldStartBootFade({
      ready: true,
      introComplete: true,
      bootComplete: false,
      fadeOut: false,
      nowMs: started + SPLASH_MIN_VISIBLE_MS,
      splashStartedAtMs: started,
    })).toBe(true)
  })

  it('is false after fade started or boot complete', () => {
    expect(shouldStartBootFade({
      ready: true,
      introComplete: true,
      bootComplete: true,
      fadeOut: false,
      nowMs: started + SPLASH_MIN_VISIBLE_MS,
      splashStartedAtMs: started,
    })).toBe(false)
    expect(shouldStartBootFade({
      ready: true,
      introComplete: true,
      bootComplete: false,
      fadeOut: true,
      nowMs: started + SPLASH_MIN_VISIBLE_MS,
      splashStartedAtMs: started,
    })).toBe(false)
  })
})

describe('canSkipBootIntro', () => {
  it('is false until runtime ready and not yet skipped', () => {
    expect(canSkipBootIntro({ ready: false, introSkipped: false })).toBe(false)
    expect(canSkipBootIntro({ ready: true, introSkipped: false })).toBe(true)
    expect(canSkipBootIntro({ ready: true, introSkipped: true })).toBe(false)
    expect(canSkipBootIntro({ ready: false, introSkipped: true })).toBe(false)
  })
})

describe('shouldShowBootLoadingStatus', () => {
  it('shows status after intro while engine still loading', () => {
    expect(shouldShowBootLoadingStatus({
      introComplete: true, ready: false, timedOut: false,
    })).toBe(true)
  })

  it('hides status when ready or timed out', () => {
    expect(shouldShowBootLoadingStatus({
      introComplete: true, ready: true, timedOut: false,
    })).toBe(false)
    expect(shouldShowBootLoadingStatus({
      introComplete: true, ready: false, timedOut: true,
    })).toBe(false)
  })
})
