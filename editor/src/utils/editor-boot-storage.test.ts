import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BOOT_SPLASH_SEEN_KEY,
  hasSeenBootSplash,
  markBootSplashSeen,
} from './editor-boot-storage'

describe('editor-boot-storage', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { window: typeof globalThis }).window = globalThis
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
      removeItem(key: string) {
        delete this.store[key]
      },
      clear() {
        this.store = {}
      },
    })
  })

  it('reports unseen until marked', () => {
    expect(hasSeenBootSplash()).toBe(false)
    markBootSplashSeen()
    expect(hasSeenBootSplash()).toBe(true)
    expect(localStorage.getItem(BOOT_SPLASH_SEEN_KEY)).toBe('1')
  })
})
