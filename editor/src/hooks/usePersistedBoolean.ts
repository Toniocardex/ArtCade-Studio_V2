// ---------------------------------------------------------------------------
// usePersistedBoolean — boolean state backed by localStorage ('1' / '0').
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'

export function usePersistedBoolean(
  key: string,
  defaultValue: boolean,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(() => {
    if (globalThis.window === undefined) return defaultValue
    const raw = globalThis.localStorage.getItem(key)
    if (raw === '1') return true
    if (raw === '0') return false
    return defaultValue
  })

  const setPersisted = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setValue((prev) => (typeof next === 'function' ? next(prev) : next))
  }, [])

  useEffect(() => {
    if (globalThis.window === undefined) return
    globalThis.localStorage.setItem(key, value ? '1' : '0')
  }, [key, value])

  return [value, setPersisted]
}
