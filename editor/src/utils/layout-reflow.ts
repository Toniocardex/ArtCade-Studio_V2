/** Pulse resize after Tauri globalThis.show() (WASM preview layout). */
export function triggerLayoutReflow(): void {
  const pulse = () => globalThis.dispatchEvent(new Event('resize'))

  pulse()
  for (const delay of [50, 150, 350]) {
    globalThis.setTimeout(pulse, delay)
  }
  requestAnimationFrame(() => requestAnimationFrame(pulse))
}
