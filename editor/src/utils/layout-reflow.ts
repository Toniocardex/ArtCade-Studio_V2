/** Pulse resize after Tauri window.show() (WASM preview layout). */
export function triggerLayoutReflow(): void {
  const pulse = () => window.dispatchEvent(new Event('resize'))

  pulse()
  for (const delay of [50, 150, 350]) {
    window.setTimeout(pulse, delay)
  }
  requestAnimationFrame(() => requestAnimationFrame(pulse))
}
