import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const watchMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => true),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  watch: (...args: unknown[]) => watchMock(...args),
}))

import { watchProjectAssets } from './asset-watcher'

describe('watchProjectAssets', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    watchMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears debounce timers when unwatch runs', async () => {
    const unwatchFs = vi.fn()
    watchMock.mockImplementation(async (_dir, handler) => {
      handler({ paths: ['C:/proj/assets/images/a.png'] })
      return unwatchFs
    })

    const onChanged = vi.fn()
    const stop = await watchProjectAssets('C:/proj', onChanged)
    expect(stop).toBeTypeOf('function')

    stop!()
    await vi.advanceTimersByTimeAsync(500)
    expect(onChanged).not.toHaveBeenCalled()
    expect(unwatchFs).toHaveBeenCalled()
  })
})
