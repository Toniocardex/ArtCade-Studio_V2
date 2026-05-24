import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  applyTheme, toggleTheme, getStoredTheme, resolveInitialTheme, initTheme,
} from './theme'

// Lightweight DOM/storage mocks so the suite stays in the node environment
// (no jsdom dependency — matches the rest of the test setup).
let attrs: Record<string, string>
let store: Record<string, string>
let prefersLight = false

beforeEach(() => {
  attrs = {}
  store = {}
  prefersLight = false
  vi.stubGlobal('document', {
    documentElement: {
      setAttribute: (k: string, v: string) => { attrs[k] = v },
      getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
      removeAttribute: (k: string) => { delete attrs[k] },
    },
  })
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  })
  vi.stubGlobal('window', {
    matchMedia: (q: string) => ({ matches: prefersLight && q.includes('light') }),
  })
})

describe('theme util (Phase E)', () => {
  it('toggleTheme flips dark/light', () => {
    expect(toggleTheme('dark')).toBe('light')
    expect(toggleTheme('light')).toBe('dark')
  })

  it('applyTheme sets data-theme + persists', () => {
    applyTheme('light')
    expect(attrs['data-theme']).toBe('light')
    expect(getStoredTheme()).toBe('light')
    applyTheme('dark')
    expect(attrs['data-theme']).toBe('dark')
    expect(getStoredTheme()).toBe('dark')
  })

  it('getStoredTheme ignores invalid values', () => {
    store['artcade-theme'] = 'banana'
    expect(getStoredTheme()).toBeNull()
  })

  it('resolveInitialTheme: stored wins over media', () => {
    prefersLight = true
    store['artcade-theme'] = 'dark'
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('resolveInitialTheme: default Dark when nothing stored', () => {
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('resolveInitialTheme: prefers-color-scheme light when no stored', () => {
    prefersLight = true
    expect(resolveInitialTheme()).toBe('light')
  })

  it('initTheme applies + returns resolved theme', () => {
    store['artcade-theme'] = 'light'
    const t = initTheme()
    expect(t).toBe('light')
    expect(attrs['data-theme']).toBe('light')
  })
})
