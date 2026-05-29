import type { PromptTextInputOptions } from './native-dialog'

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

/** Queue an in-editor themed text prompt (resolved when the modal closes). */
export function requestTextPrompt(options: PromptTextInputOptions): Promise<string | null> {
  return new Promise((resolve) => {
    pending = { id: ++nextId, options, resolve }
    notify()
  })
}

export function completeTextPrompt(value: string | null): void {
  if (!pending) return
  pending.resolve(value)
  pending = null
  notify()
}
