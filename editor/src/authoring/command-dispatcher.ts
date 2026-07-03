import type { Dispatch } from 'react'
import type { Action } from '../store/editor-store'
import { commandApplied, type CommandResult } from './command-result'
import type { ProjectAuthoringCommand } from './commands/project'
import type { AssetAuthoringCommand } from './commands/assets'

export type AuthoringCommand =
  | ProjectAuthoringCommand
  | AssetAuthoringCommand

export type AuthoringCommandContext = Readonly<{
  dispatch: Dispatch<Action>
}>

export function dispatchAuthoringCommand(
  command: AuthoringCommand,
  context: AuthoringCommandContext,
): CommandResult {
  switch (command.type) {
    case 'project.rename':
      context.dispatch({ type: 'PROJECT_RENAME', name: command.name })
      return commandApplied()
    case 'asset.delete':
      switch (command.kind) {
        case 'image':
          context.dispatch({ type: 'ASSET_REMOVE', assetId: command.assetId })
          return commandApplied()
        case 'audio':
          context.dispatch({ type: 'AUDIO_ASSET_REMOVE', assetId: command.assetId })
          return commandApplied()
        case 'font':
          context.dispatch({ type: 'FONT_ASSET_REMOVE', assetId: command.assetId })
          return commandApplied()
        case 'tileset':
          context.dispatch({ type: 'TILESET_ASSET_REMOVE', assetId: command.assetId })
          return commandApplied()
      }
  }
}
