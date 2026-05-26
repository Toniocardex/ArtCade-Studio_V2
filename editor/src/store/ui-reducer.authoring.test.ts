import { describe, expect, it, beforeEach, vi } from 'vitest'
import { uiReducer } from './reducers/ui-reducer'
import { initialCoreState } from './editor-store-state'
import { AUTHORING_MODE_STORAGE_KEY } from '../types/authoring-mode'

let store: Record<string, string>
let attrs: Record<string, string>

describe('uiReducer SET_AUTHORING_MODE', () => {
  beforeEach(() => {
    store = {}
    attrs = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
    })
    vi.stubGlobal('document', {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          attrs[k] = v
        },
        getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
        removeAttribute: (k: string) => {
          delete attrs[k]
        },
      },
    })
  })

  it('persists and updates state', () => {
    const next = uiReducer(initialCoreState, {
      type: 'SET_AUTHORING_MODE',
      mode: 'advanced',
    })
    expect(next.authoringMode).toBe('advanced')
    expect(store[AUTHORING_MODE_STORAGE_KEY]).toBe('advanced')
    expect(attrs['data-authoring-mode']).toBe('advanced')
  })

  it('no-ops when unchanged', () => {
    const base = { ...initialCoreState, authoringMode: 'base' as const }
    expect(
      uiReducer(base, { type: 'SET_AUTHORING_MODE', mode: 'base' }),
    ).toBe(base)
  })
})
