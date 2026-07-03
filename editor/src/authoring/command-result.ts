export type CommandResult =
  | { status: 'applied' }
  | { status: 'noop'; reason?: string }
  | { status: 'blocked'; reason: string }
  | { status: 'validation-error'; reason: string }

export const commandApplied = (): CommandResult => ({ status: 'applied' })

