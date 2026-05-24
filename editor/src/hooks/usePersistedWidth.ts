// ---------------------------------------------------------------------------
// usePersistedWidth — useState backed by localStorage with clamp.
// Used by CanvasView sidebars to remember the user's preferred panel widths.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'

export function usePersistedWidth(
  key: string,
  defaultPx: number,
  min = 180,
  max = 480,
): [number, (next: number | ((prev: number) => number)) => void] {
  const [value, setValue] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultPx
    const raw = window.localStorage.getItem(key)
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
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, String(value))
  }, [key, value])

  return [value, setClamped]
}
