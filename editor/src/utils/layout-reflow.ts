let reflowTimerIds: ReturnType<typeof globalThis.setTimeout>[] = []

/** Pulse resize after Tauri globalThis.show() (WASM preview layout). */
export function triggerLayoutReflow(): void {
  for (const id of reflowTimerIds) globalThis.clearTimeout(id)
  reflowTimerIds = []

  const pulse = () => globalThis.dispatchEvent(new Event('resize'))

  pulse()
  reflowTimerIds = [50, 150, 350].map((delay) => globalThis.setTimeout(pulse, delay))
  requestAnimationFrame(() => requestAnimationFrame(pulse))
}
