import type { Dispatch } from 'react'
import type { Action } from '../store/editor-store'
import type { ProjectDoc } from '../types'
import { commandApplied, type CommandResult } from './command-result'
import type { AuthoringCommand } from './commands'
import { materializeAuthoringCommand } from './materialize-authoring-command'

export type AuthoringCommandContext = Readonly<{
  dispatch: Dispatch<Action>
  project?: ProjectDoc | null
}>

export function dispatchAuthoringCommand(
  command: AuthoringCommand,
  context: AuthoringCommandContext,
): CommandResult {
  const materialized = materializeAuthoringCommand(command, { project: context.project })
  if (materialized.status !== 'applied') return materialized

  for (const action of materialized.actions) {
    context.dispatch(action)
  }

  return commandApplied()
}
