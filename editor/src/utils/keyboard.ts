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

export function isDeleteKey(e: { key: string; code: string }): boolean {
  return e.key === 'Delete' || e.code === 'Delete'
}

/** Apply backward-delete in a text input (WebView2 often blocks native Backspace). */
export function applyInputBackspace(input: HTMLInputElement): boolean {
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0
  if (start === 0 && start === end) return false
  const v = input.value
  const next = start === end
    ? v.slice(0, start - 1) + v.slice(start)
    : v.slice(0, start) + v.slice(end)
  const newPos = start === end ? start - 1 : start
  input.value = next
  input.setSelectionRange(newPos, newPos)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

/** Apply forward-delete in a text input (WebView2 often blocks native Delete). */
export function applyInputDelete(input: HTMLInputElement): boolean {
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0
  const v = input.value
  if (start >= v.length && start === end) return false
  const next = start === end
    ? v.slice(0, start) + v.slice(start + 1)
    : v.slice(0, start) + v.slice(end)
  input.value = next
  input.setSelectionRange(start, start)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

let guardsInstalled = false

/**
 * Block browser/WebView default actions that interfere with editor shortcuts,
 * registered in the capture phase so preventDefault() fires before any bubble
 * listener and before WebView2's native key handling.
 *
 * - Backspace: prevents browser "go back" navigation
 * - F5 (no modifier): prevents page reload so usePreviewPlayShortcut can fire
 */
export function installEditorKeyboardGuards(): void {
  if (guardsInstalled || globalThis.window === undefined) return
  guardsInstalled = true
  globalThis.addEventListener(
    'keydown',
    (e) => {
      if (isBackspaceKey(e)) {
        if (!shouldIgnoreEditorShortcut(e)) e.preventDefault()
        return
      }
      if ((e.key === 'F5' || e.code === 'F5') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
      }
    },
    true,
  )
}
