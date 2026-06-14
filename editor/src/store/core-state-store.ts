// ---------------------------------------------------------------------------
// core-state-store — external store for granular CoreState subscriptions
// ---------------------------------------------------------------------------

import type { CoreState } from './editor-store-state'

export type CoreStateListener = () => void

export interface CoreStateStore {
  getState: () => CoreState
  setState: (next: CoreState) => void
  /** Mirror reducer output during parent render without notifying subscribers. */
  replaceStateSilent: (next: CoreState) => void
  /** Wake useSyncExternalStore subscribers after a silent mirror. */
  notifyListeners: () => void
  subscribe: (listener: CoreStateListener) => () => void
}

export function createCoreStateStore(initial: CoreState): CoreStateStore {
  let state = initial
  const listeners = new Set<CoreStateListener>()

  return {
    getState: () => state,
    setState: (next: CoreState) => {
      if (next === state) return
      state = next
      for (const listener of listeners) listener()
    },
    replaceStateSilent: (next: CoreState) => {
      if (next === state) return
      state = next
    },
    notifyListeners: () => {
      for (const listener of listeners) listener()
    },
    subscribe: (listener: CoreStateListener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/** Shallow compare for selector results that are plain objects or arrays. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false
    }
    return true
  }

  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const aKeys = Object.keys(aObj)
  if (aKeys.length !== Object.keys(bObj).length) return false
  for (const key of aKeys) {
    if (!Object.is(aObj[key], bObj[key])) return false
  }
  return true
}
