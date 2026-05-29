import { startTransition } from 'react'

export type WasmUiUpdateOptions = Readonly<{
  /**
   * Run on the next microtask without `startTransition`.
   * Use for selection, engine-ready, tile paint, transforms, and forced errors.
   */
  urgent?: boolean
}>

/**
 * Single scheduler for Emscripten/WASM callbacks → React store updates.
 * Defers work off the native callback stack via `queueMicrotask`; non-urgent
 * updates use `startTransition` so logs and cursor motion do not block input.
 */
export function scheduleWasmUiUpdate(fn: () => void, options?: WasmUiUpdateOptions): void {
  const run = () => {
    fn()
  }

  if (options?.urgent) {
    queueMicrotask(run)
    return
  }

  queueMicrotask(() => startTransition(run))
}

/** Like `scheduleWasmUiUpdate`, but skips when `cancelled()` is true at run time. */
export function scheduleWasmUiUpdateWhen(
  cancelled: () => boolean,
  fn: () => void,
  options?: WasmUiUpdateOptions,
): void {
  scheduleWasmUiUpdate(() => {
    if (cancelled()) return
    fn()
  }, options)
}
