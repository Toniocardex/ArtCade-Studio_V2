import { runtimeSync } from './runtime-sync-service'

let bootSessionResetDone = false

/**
 * One synchronous reset per app session before the editor tree mounts.
 * Runs in EditorProvider render (before PreviewPanel effects) so engine/boot
 * flags are not cleared after Bridge initialised.
 */
export function ensureBootSessionReset(): void {
  if (bootSessionResetDone) return
  bootSessionResetDone = true
  runtimeSync.reset()
}

/** Test-only: allow multiple resets across vitest cases. */
export function resetBootSessionMarker(): void {
  bootSessionResetDone = false
}
