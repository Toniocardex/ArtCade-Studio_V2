/**
 * In-editor multi-choice prompt (themed), same queue pattern as text-prompt /
 * project-save-recovery. Used for Save All / Discard / Cancel unsaved guards.
 */

export type ChoicePromptId = string

export type ChoicePromptOption<T extends string> = Readonly<{
  id: T
  label: string
  kind?: 'primary' | 'danger' | 'default'
}>

export type ChoicePromptOptions<T extends string> = Readonly<{
  title: string
  message: string
  choices: readonly ChoicePromptOption<T>[]
  /** Returned when the dialog is dismissed (Escape / backdrop). Defaults to first non-primary. */
  cancelId: T
}>

export type ChoicePromptRequest<T extends string = string> = Readonly<{
  id: number
  options: ChoicePromptOptions<T>
  resolve: (value: T) => void
}>

let nextId = 0
let pending: ChoicePromptRequest | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeChoicePrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getChoicePromptRequest(): ChoicePromptRequest | null {
  return pending
}

export class ChoicePromptBusyError extends Error {
  constructor() {
    super('A choice prompt is already open')
    this.name = 'ChoicePromptBusyError'
  }
}

/**
 * Queue a themed multi-choice dialog. Resolves with the selected option id.
 */
export function requestChoicePrompt<T extends string>(
  options: ChoicePromptOptions<T>,
): Promise<T> {
  if (pending) {
    return Promise.reject(new ChoicePromptBusyError())
  }
  return new Promise((resolve) => {
    pending = {
      id: ++nextId,
      options: options as ChoicePromptOptions<string>,
      resolve: resolve as (value: string) => void,
    }
    notify()
  })
}

export function completeChoicePrompt(value: string): void {
  if (!pending) return
  const cancelId = pending.options.cancelId
  const allowed = pending.options.choices.some((c) => c.id === value)
  pending.resolve(allowed ? value : cancelId)
  pending = null
  notify()
}

/** @internal Vitest helper */
export function resetChoicePromptForTests(): void {
  pending = null
  notify()
}
