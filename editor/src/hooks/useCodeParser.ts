import { useCallback, useRef } from 'react'

const PARSE_DEBOUNCE_MS = 400

/**
 * Debounced Lua edit callback (placeholder for future Lua → Logic Board sync).
 * Logic Board → Lua is handled by `compileLogicBoard`; reverse parse is not v1.
 */
export function useCodeParser(onParsed?: (code: string) => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(onParsed)
  callbackRef.current = onParsed

  return useCallback((code: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      callbackRef.current?.(code)
    }, PARSE_DEBOUNCE_MS)
  }, [])
}
