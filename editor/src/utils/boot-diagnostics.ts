// ---------------------------------------------------------------------------
// boot-diagnostics — capture WASM/runtime lines before the editor shell is usable
// ---------------------------------------------------------------------------

export interface BootDiagnosticLine {
  message: string
  level: string
  atMs: number
}

const MAX_LINES = 40
const lines: BootDiagnosticLine[] = []
const listeners = new Set<() => void>()

function notify(): void {
  for (const cb of listeners) cb()
}

/**
 * Records a runtime log line for the boot splash (ring buffer).
 */
export function captureBootLine(message: string, level: string): void {
  const text = message.trim()
  if (!text) return
  lines.push({ message: text, level, atMs: Date.now() })
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES)
  notify()
}

/** Last error/warn lines, newest last (max 3). */
export function getBootDiagnosticHints(): string[] {
  const picked: string[] = []
  for (let i = lines.length - 1; i >= 0 && picked.length < 3; i--) {
    const row = lines[i]
    if (row.level === 'error' || row.level === 'warn') {
      picked.unshift(row.message)
    }
  }
  return picked
}

export function getBootDiagnosticLines(): readonly BootDiagnosticLine[] {
  return lines
}

export function subscribeBootDiagnostics(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/**
 * Install before React mounts so early Emscripten stderr is not lost behind the splash.
 */
export function installBootDiagnosticsTap(): void {
  const g = globalThis as typeof globalThis & {
    onConsoleLine?: (message: string, level: string) => void
  }
  const prev = g.onConsoleLine
  if (prev && (prev as { __bootTap?: boolean }).__bootTap) return

  const tap = (message: string, level: string) => {
    captureBootLine(message, level)
    prev?.(message, level)
  }
  ;(tap as { __bootTap?: boolean }).__bootTap = true
  g.onConsoleLine = tap
}
