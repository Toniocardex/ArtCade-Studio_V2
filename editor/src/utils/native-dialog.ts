/**
 * Native OS dialogs in Tauri (Win32 message boxes + input on Windows).
 * Browser fallbacks only when not running inside the Tauri shell.
 */
import { invoke, isTauri } from '@tauri-apps/api/core'
import { confirm as tauriConfirm, message as tauriMessage } from '@tauri-apps/plugin-dialog'

export async function confirmDialog(
  message: string,
  options?: { title?: string; kind?: 'info' | 'warning' | 'error' },
): Promise<boolean> {
  if (isTauri()) {
    return tauriConfirm(message, {
      title: options?.title ?? 'ArtCade Editor',
      kind: options?.kind ?? 'warning',
      okLabel: 'OK',
      cancelLabel: 'Cancel',
    })
  }
  return globalThis.confirm(message)
}

export async function alertDialog(
  message: string,
  options?: { title?: string; kind?: 'info' | 'warning' | 'error' },
): Promise<void> {
  if (isTauri()) {
    await tauriMessage(message, {
      title: options?.title ?? 'ArtCade Editor',
      kind: options?.kind ?? 'info',
    })
    return
  }
  globalThis.alert(message)
}

export type PromptTextInputOptions = Readonly<{
  title: string
  message: string
  defaultValue?: string
}>

/** Native text field (Rust → Win32 on Windows). Returns null if cancelled. */
export async function promptTextInput(
  options: PromptTextInputOptions,
): Promise<string | null> {
  if (isTauri()) {
    const value = await invoke<string | null>('prompt_text_input', {
      title: options.title,
      message: options.message,
      defaultValue: options.defaultValue ?? '',
    })
    if (value == null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  const fallback = globalThis.prompt(options.message, options.defaultValue ?? '')
  if (fallback == null) return null
  const trimmed = fallback.trim()
  return trimmed.length > 0 ? trimmed : null
}
