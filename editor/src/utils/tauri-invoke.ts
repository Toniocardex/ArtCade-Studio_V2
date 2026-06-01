import { invoke, isTauri } from '@tauri-apps/api/core'

/**
 * Invoke a Tauri command with consistent error propagation.
 * Re-throws so callers can log or show UI; use `invokeTauriOrNull` when
 * browser mode should no-op without throwing.
 */
export async function invokeTauri<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri()) {
    throw new Error(`[tauri-invoke] ${command}: not available outside the desktop shell`)
  }
  try {
    return await invoke<T>(command, args)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`[tauri-invoke] ${command} failed: ${detail}`, { cause: err })
  }
}

/** Desktop invoke, or `null` in browser mode (no throw). */
export async function invokeTauriOrNull<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!isTauri()) return null
  return invokeTauri<T>(command, args)
}
