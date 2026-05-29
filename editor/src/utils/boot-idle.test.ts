import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scheduleBootIdleTask } from './boot-idle'

describe('scheduleBootIdleTask', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the callback via setTimeout when requestIdleCallback is missing', () => {
    const prev = globalThis.requestIdleCallback
    // @ts-expect-error test shim
    delete globalThis.requestIdleCallback
    const cb = vi.fn()
    scheduleBootIdleTask(cb)
    expect(cb).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(cb).toHaveBeenCalledOnce()
    globalThis.requestIdleCallback = prev
  })
})
