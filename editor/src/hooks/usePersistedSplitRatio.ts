import { useCallback, useEffect, useState } from 'react'

/** Persisted vertical split ratio (0–100 = top pane share). */
export function usePersistedSplitRatio(
  key: string,
  defaultPct: number,
  min = 25,
  max = 75,
): [number, (next: number | ((prev: number) => number)) => void] {
  const [value, setValue] = useState<number>(() => {
    if (globalThis.window === undefined) return defaultPct
    const raw = globalThis.localStorage.getItem(key)
    if (!raw) return defaultPct
    const n = Number(raw)
    if (!Number.isFinite(n)) return defaultPct
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
