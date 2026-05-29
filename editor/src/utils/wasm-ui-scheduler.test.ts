import { describe, it, expect, vi, beforeEach } from 'vitest'

const startTransitionMock = vi.hoisted(() => vi.fn((fn: () => void) => { fn() }))

vi.mock('react', () => ({
  startTransition: (fn: () => void) => startTransitionMock(fn),
}))

import {
  scheduleWasmUiUpdate,
  scheduleWasmUiUpdateWhen,
} from './wasm-ui-scheduler'

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
}

describe('scheduleWasmUiUpdate', () => {
  beforeEach(() => {
    startTransitionMock.mockClear()
  })

  it('runs urgent callbacks on a microtask without startTransition', async () => {
    const fn = vi.fn()
    scheduleWasmUiUpdate(fn, { urgent: true })
    expect(fn).not.toHaveBeenCalled()
    await flushMicrotasks()
    expect(fn).toHaveBeenCalledOnce()
    expect(startTransitionMock).not.toHaveBeenCalled()
  })

  it('wraps non-urgent callbacks in startTransition on a microtask', async () => {
    const fn = vi.fn()
    scheduleWasmUiUpdate(fn)
    expect(fn).not.toHaveBeenCalled()
    await flushMicrotasks()
    expect(startTransitionMock).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('scheduleWasmUiUpdateWhen respects cancelled at run time', async () => {
    const fn = vi.fn()
    let cancelled = true
    scheduleWasmUiUpdateWhen(() => cancelled, fn, { urgent: true })
    await flushMicrotasks()
    expect(fn).not.toHaveBeenCalled()

    cancelled = false
    scheduleWasmUiUpdateWhen(() => cancelled, fn, { urgent: true })
    await flushMicrotasks()
    expect(fn).toHaveBeenCalledOnce()
  })
})
