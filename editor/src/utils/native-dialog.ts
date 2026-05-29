/**
 * Dialogs: confirm/alert use Tauri plugin (native). Text prompts use the in-editor
 * themed modal so UI stays consistent with the Slate Night shell.
 */
import { isTauri } from '@tauri-apps/api/core'
import { confirm as tauriConfirm, message as tauriMessage } from '@tauri-apps/plugin-dialog'
import { requestTextPrompt } from './text-prompt'

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

/** Themed editor modal. Returns null if cancelled or empty. */
export async function promptTextInput(
  options: PromptTextInputOptions,
): Promise<string | null> {
  const value = await requestTextPrompt(options)
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
