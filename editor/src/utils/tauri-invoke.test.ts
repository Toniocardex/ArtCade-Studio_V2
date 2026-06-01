import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => true),
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

import { invokeTauri, invokeTauriOrNull } from './tauri-invoke'
import { isTauri } from '@tauri-apps/api/core'

describe('invokeTauri', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    vi.mocked(isTauri).mockReturnValue(true)
  })

  it('forwards to invoke and returns the result', async () => {
    invokeMock.mockResolvedValue({ ok: true })
    const out = await invokeTauri<{ ok: boolean }>('check_dependencies_cmd')
    expect(out).toEqual({ ok: true })
    expect(invokeMock).toHaveBeenCalledWith('check_dependencies_cmd', undefined)
  })

  it('wraps invoke failures with command name', async () => {
    invokeMock.mockRejectedValue(new Error('disk full'))
    await expect(invokeTauri('write_file', { path: '/x' }))
      .rejects
      .toThrow('[tauri-invoke] write_file failed: disk full')
  })

  it('invokeTauriOrNull returns null outside Tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    await expect(invokeTauri('write_file')).rejects.toThrow('not available')
    expect(await invokeTauriOrNull('write_file')).toBeNull()
  })
})
