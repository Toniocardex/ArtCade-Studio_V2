/** Focused element for a key event (target + activeElement; WebView-safe). */
export function keyboardFocusElement(e: KeyboardEvent): HTMLElement | null {
  if (e.target instanceof HTMLElement) return e.target
  const active = document.activeElement
  return active instanceof HTMLElement ? active : null
}

/** True when the user is typing in a standard form control (do not bind Delete/Backspace globally). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

/** True when focus is inside a marked editor panel (Inspector, Logic Board inputs, etc.). */
export function isInsidePanel(target: EventTarget | null, panelId: string): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest(`[data-panel="${panelId}"]`))
}

/** Skip global shortcuts while the user edits text in the UI. */
export function shouldIgnoreEditorShortcut(e: KeyboardEvent): boolean {
  const el = keyboardFocusElement(e)
  if (!el) return false
  if (isEditableTarget(el)) return true
  if (isInsidePanel(el, 'inspector')) return true
  if (isInsidePanel(el, 'scene-objects')) return true
  return false
}

export function isBackspaceKey(e: { key: string; code: string }): boolean {
  return e.key === 'Backspace' || e.code === 'Backspace'
}

/** Apply backward-delete in a text input (WebView2 often blocks native Backspace). */
export function applyInputBackspace(input: HTMLInputElement): boolean {
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0
  if (start === 0 && start === end) return false
  const v = input.value
  const next = start !== end
    ? v.slice(0, start) + v.slice(end)
    : v.slice(0, start - 1) + v.slice(start)
  const newPos = start !== end ? start : start - 1
  input.value = next
  input.setSelectionRange(newPos, newPos)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

let guardsInstalled = false

/** Block browser/WebView "go back" on Backspace outside text fields. */
export function installEditorKeyboardGuards(): void {
  if (guardsInstalled || typeof window === 'undefined') return
  guardsInstalled = true
  window.addEventListener(
    'keydown',
    (e) => {
      if (!isBackspaceKey(e)) return
      if (shouldIgnoreEditorShortcut(e)) return
      e.preventDefault()
    },
    true,
  )
}
