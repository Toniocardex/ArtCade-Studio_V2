export type ProjectRecoveryChoice = 'recovery' | 'saved' | 'discard'

export type ProjectSaveRecoveryPrompt = Readonly<{
  id: number
  recoveryPath: string
  savedPath: string
  recoveryLabel: string
  resolve: (choice: ProjectRecoveryChoice) => void
}>

let nextId = 0
let pending: ProjectSaveRecoveryPrompt | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listeners()
}

export function subscribeProjectSaveRecoveryPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getProjectSaveRecoveryPrompt(): ProjectSaveRecoveryPrompt | null {
  return pending
}

export function requestProjectSaveRecoveryChoice(
  recoveryPath: string,
  savedPath: string,
  recoveryLabel: string,
): Promise<ProjectRecoveryChoice> {
  if (pending) {
    return Promise.reject(new Error('A project recovery prompt is already open'))
  }
  return new Promise((resolve) => {
    pending = {
      id: ++nextId,
      recoveryPath,
      savedPath,
      recoveryLabel,
      resolve,
    }
    notify()
  })
}

export function completeProjectSaveRecoveryChoice(choice: ProjectRecoveryChoice): void {
  if (!pending) return
  pending.resolve(choice)
  pending = null
  notify()
}

/** @internal Vitest helper */
export function resetProjectSaveRecoveryPromptForTests(): void {
  pending = null
  notify()
}
