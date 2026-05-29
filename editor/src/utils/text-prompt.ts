import type { PromptTextInputOptions } from './native-dialog'

export const TEXT_PROMPT_TEST_IDS = {
  modal: 'text-prompt-modal',
  input: 'text-prompt-input',
  submit: 'text-prompt-submit',
  cancel: 'text-prompt-cancel',
} as const

export class TextPromptBusyError extends Error {
  constructor() {
    super('A text prompt is already open')
    this.name = 'TextPromptBusyError'
  }
}

export type TextPromptRequest = Readonly<{
  id: number
  options: PromptTextInputOptions
  resolve: (value: string | null) => void
}>

let nextId = 0
let pending: TextPromptRequest | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeTextPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTextPromptRequest(): TextPromptRequest | null {
  return pending
}

export function trimPromptResult(value: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Queue an in-editor themed text prompt (resolved when the modal closes). */
export function requestTextPrompt(options: PromptTextInputOptions): Promise<string | null> {
  if (pending) {
    return Promise.reject(new TextPromptBusyError())
  }
  return new Promise((resolve) => {
    pending = { id: ++nextId, options, resolve }
    notify()
  })
}

export async function requestTextPromptTrimmed(
  options: PromptTextInputOptions,
): Promise<string | null> {
  return trimPromptResult(await requestTextPrompt(options))
}

export function completeTextPrompt(value: string | null): void {
  if (!pending) return
  pending.resolve(value)
  pending = null
  notify()
}

/** @internal Vitest helper — clears queue without resolving. */
export function resetTextPromptForTests(): void {
  pending = null
  notify()
}
