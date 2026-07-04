import type { Dispatch } from 'react'
import type { Action } from '../store/editor-store'
import type { ProjectDoc } from '../types'
import { commandApplied, type CommandResult } from './command-result'
import type { ProjectAuthoringCommand } from './commands/project'
import type { AssetAuthoringCommand } from './commands/assets'
import type { SceneAuthoringCommand } from './commands/scenes'

export type AuthoringCommand =
  | ProjectAuthoringCommand
  | AssetAuthoringCommand
  | SceneAuthoringCommand

export type AuthoringCommandContext = Readonly<{
  dispatch: Dispatch<Action>
  project?: ProjectDoc | null
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
    case 'asset.rename':
      switch (command.kind) {
        case 'image':
          context.dispatch({ type: 'IMAGE_ASSET_RENAME', assetId: command.assetId, name: command.name })
          return commandApplied()
        case 'audio':
          context.dispatch({ type: 'AUDIO_ASSET_RENAME', assetId: command.assetId, name: command.name })
          return commandApplied()
        case 'font':
          context.dispatch({ type: 'FONT_ASSET_RENAME', assetId: command.assetId, name: command.name })
          return commandApplied()
        case 'tileset':
          context.dispatch({ type: 'TILESET_ASSET_RENAME', assetId: command.assetId, name: command.name })
          return commandApplied()
      }
    case 'asset.image.patch': {
      const asset = context.project?.assets?.[command.assetId]
      if (!asset) return { status: 'validation-error', reason: 'image-asset-not-found' }
      context.dispatch({ type: 'ASSET_ADD', asset: { ...asset, ...command.patch, id: command.assetId } })
      return commandApplied()
    }
    case 'asset.image.setClips':
      context.dispatch({
        type: 'IMAGE_ASSET_SET_CLIPS',
        assetId: command.assetId,
        clips: command.clips,
        coalesceKey: command.coalesceKey,
      })
      return commandApplied()
    case 'scene.addEmpty':
      context.dispatch({ type: 'SCENE_ADD_EMPTY', sourceSceneId: command.sourceSceneId })
      return commandApplied()
    case 'scene.rename':
      context.dispatch({ type: 'SCENE_RENAME', sceneId: command.sceneId, name: command.name })
      return commandApplied()
    case 'scene.setStart':
      context.dispatch({ type: 'SCENE_SET_START', sceneId: command.sceneId })
      return commandApplied()
    case 'scene.delete':
      context.dispatch({ type: 'SCENE_DELETE', sceneId: command.sceneId })
      return commandApplied()
    case 'scene.duplicate':
      context.dispatch({ type: 'SCENE_DUPLICATE', sceneId: command.sceneId })
      return commandApplied()
    case 'object.create':
      context.dispatch(command.action)
      return commandApplied()
    case 'scene.instance.addFromType':
      context.dispatch({
        type: 'INSTANCE_ADD_FROM_TYPE',
        sceneId: command.sceneId,
        objectTypeId: command.objectTypeId,
      })
      return commandApplied()
    case 'scene.instance.duplicate':
      context.dispatch({
        type: 'INSTANCE_DUPLICATE',
        instanceId: command.instanceId,
        sceneId: command.sceneId,
      })
      return commandApplied()
    case 'scene.instance.setVisible':
      context.dispatch({
        type: 'ENTITY_SET_VISIBLE',
        entityId: command.entityId,
        visible: command.visible,
      })
      return commandApplied()
    case 'scene.instance.rename':
      context.dispatch({ type: 'ENTITY_SET_NAME', entityId: command.entityId, name: command.name })
      return commandApplied()
    case 'objectType.rename':
      context.dispatch({
        type: 'OBJECT_TYPE_RENAME',
        objectTypeId: command.objectTypeId,
        displayName: command.displayName,
      })
      return commandApplied()
  }
}
