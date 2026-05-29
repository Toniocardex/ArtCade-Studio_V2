/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSplashChoreography } from './useSplashChoreography'
import {
  SPLASH_INTRO_HOLD_MS,
  SPLASH_SKIP_INTRO_COMPLETE_MS,
  SPLASH_STEP_DELAYS_MS,
} from './splash-choreography'

describe('useSplashChoreography', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays grid → streams → title hold, then intro complete without exit blur', () => {
    const onIntroComplete = vi.fn()
    const { result } = renderHook(() => useSplashChoreography({ onIntroComplete }))

    expect(result.current).toBe(0)

    act(() => { vi.advanceTimersByTime(SPLASH_STEP_DELAYS_MS.grid) })
    expect(result.current).toBe(1)

    act(() => { vi.advanceTimersByTime(SPLASH_STEP_DELAYS_MS.streams - SPLASH_STEP_DELAYS_MS.grid) })
    expect(result.current).toBe(2)

    act(() => { vi.advanceTimersByTime(SPLASH_STEP_DELAYS_MS.title - SPLASH_STEP_DELAYS_MS.streams) })
    expect(result.current).toBe(3)

    act(() => { vi.advanceTimersByTime(SPLASH_INTRO_HOLD_MS - SPLASH_STEP_DELAYS_MS.title) })
    expect(onIntroComplete).toHaveBeenCalledOnce()
    expect(result.current).toBe(3)
  })

  it('skip jumps to title hold and completes intro after a short beat', () => {
    const onIntroComplete = vi.fn()
    const { result, rerender } = renderHook(
      ({ skipped }: { skipped: boolean }) => useSplashChoreography({ skipped, onIntroComplete }),
      { initialProps: { skipped: false } },
    )

    rerender({ skipped: true })
    expect(result.current).toBe(3)

    act(() => { vi.advanceTimersByTime(SPLASH_SKIP_INTRO_COMPLETE_MS) })
    expect(onIntroComplete).toHaveBeenCalledOnce()
  })

  it('does not restart timers on parent re-render with stable callback', () => {
    const onIntroComplete = vi.fn()
    const { rerender } = renderHook(() => useSplashChoreography({ onIntroComplete }))

    act(() => { vi.advanceTimersByTime(2000) })
    rerender()
    act(() => { vi.advanceTimersByTime(SPLASH_INTRO_HOLD_MS) })

    expect(onIntroComplete).toHaveBeenCalledOnce()
  })

  it('exiting plays step 4 blur only when gate fades', () => {
    const { result, rerender } = renderHook(
      ({ exiting }: { exiting: boolean }) => useSplashChoreography({ exiting }),
      { initialProps: { exiting: false } },
    )

    rerender({ exiting: true })
    expect(result.current).toBe(4)
  })
})
