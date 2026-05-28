// ---------------------------------------------------------------------------
// usePersistedHeight — useState backed by localStorage with clamp.
// Used by BottomDock to remember the user's preferred panel height.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'

export function usePersistedHeight(
  key: string,
  defaultPx: number,
  min = 120,
  max = 480,
): [number, (next: number | ((prev: number) => number)) => void] {
  const [value, setValue] = useState<number>(() => {
    if (globalThis.window === undefined) return defaultPx
    const raw = globalThis.localStorage.getItem(key)
    if (!raw) return defaultPx
    const n = Number(raw)
    if (!Number.isFinite(n)) return defaultPx
    return Math.min(max, Math.max(min, Math.round(n)))
  })

  const setClamped = useCallback(
    (next: number | ((prev: number) => number)) => {
      setValue((prev) => {
        const raw = typeof next === 'function' ? next(prev) : next
        return Math.min(max, Math.max(min, Math.round(raw)))
      })
    },
    [min, max],
  )

  useEffect(() => {
    if (globalThis.window === undefined) return
    globalThis.localStorage.setItem(key, String(value))
  }, [key, value])

  return [value, setClamped]
}
