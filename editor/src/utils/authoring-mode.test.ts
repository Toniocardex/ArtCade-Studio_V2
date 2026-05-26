import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  readStoredAuthoringMode,
  persistAuthoringMode,
  isAuthoringMode,
} from './authoring-mode'
import { AUTHORING_MODE_STORAGE_KEY } from '../types/authoring-mode'

let store: Record<string, string>

beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
  })
})

describe('authoring-mode', () => {
  it('defaults to base when unset', () => {
    expect(readStoredAuthoringMode()).toBe('base')
  })

  it('round-trips persistence', () => {
    persistAuthoringMode('advanced')
    expect(readStoredAuthoringMode()).toBe('advanced')
    expect(store[AUTHORING_MODE_STORAGE_KEY]).toBe('advanced')
    expect(isAuthoringMode('base')).toBe(true)
    expect(isAuthoringMode('foo')).toBe(false)
  })
})
