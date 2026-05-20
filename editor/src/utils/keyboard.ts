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
  if (isEditableTarget(e.target)) return true
  if (isInsidePanel(e.target, 'inspector')) return true
  return false
}
