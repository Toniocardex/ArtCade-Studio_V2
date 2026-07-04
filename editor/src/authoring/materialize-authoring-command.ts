import type { Action } from '../store/editor-store-state'
import type { ProjectDoc } from '../types'
import type { CommandResult } from './command-result'
import type { AuthoringCommand } from './commands'

export type MaterializedAuthoringCommand =
  | { status: 'applied'; actions: readonly Action[] }
  | Exclude<CommandResult, { status: 'applied' }>

export type MaterializeAuthoringCommandContext = Readonly<{
  project?: ProjectDoc | null
}>

const actionsApplied = (...actions: Action[]): MaterializedAuthoringCommand => ({
  status: 'applied',
  actions,
})

export function materializeAuthoringCommand(
  command: AuthoringCommand,
  context: MaterializeAuthoringCommandContext = {},
): MaterializedAuthoringCommand {
  switch (command.type) {
    case 'project.rename':
      return actionsApplied({ type: 'PROJECT_RENAME', name: command.name })
    case 'asset.image.upsert':
      return actionsApplied({ type: 'ASSET_ADD', asset: command.asset })
    case 'asset.audio.upsert':
      return actionsApplied({ type: 'AUDIO_ASSET_ADD', asset: command.asset })
    case 'asset.font.upsert':
      return actionsApplied({ type: 'FONT_ASSET_ADD', asset: command.asset })
    case 'asset.tileset.upsert':
      return actionsApplied({ type: 'TILESET_ASSET_ADD', asset: command.asset })
    case 'asset.delete':
      switch (command.kind) {
        case 'image':
          return actionsApplied({ type: 'ASSET_REMOVE', assetId: command.assetId })
        case 'audio':
          return actionsApplied({ type: 'AUDIO_ASSET_REMOVE', assetId: command.assetId })
        case 'font':
          return actionsApplied({ type: 'FONT_ASSET_REMOVE', assetId: command.assetId })
        case 'tileset':
          return actionsApplied({ type: 'TILESET_ASSET_REMOVE', assetId: command.assetId })
      }
    case 'asset.rename':
      switch (command.kind) {
        case 'image':
          return actionsApplied({ type: 'IMAGE_ASSET_RENAME', assetId: command.assetId, name: command.name })
        case 'audio':
          return actionsApplied({ type: 'AUDIO_ASSET_RENAME', assetId: command.assetId, name: command.name })
        case 'font':
          return actionsApplied({ type: 'FONT_ASSET_RENAME', assetId: command.assetId, name: command.name })
        case 'tileset':
          return actionsApplied({ type: 'TILESET_ASSET_RENAME', assetId: command.assetId, name: command.name })
      }
    case 'asset.image.patch': {
      const asset = context.project?.assets?.[command.assetId]
      if (!asset) return { status: 'validation-error', reason: 'image-asset-not-found' }
      return actionsApplied({
        type: 'ASSET_ADD',
        asset: { ...asset, ...command.patch, id: command.assetId },
      })
    }
    case 'asset.image.setClips':
      return actionsApplied({
        type: 'IMAGE_ASSET_SET_CLIPS',
        assetId: command.assetId,
        clips: command.clips,
        coalesceKey: command.coalesceKey,
      })
    case 'scene.addEmpty':
      return actionsApplied({ type: 'SCENE_ADD_EMPTY', sourceSceneId: command.sourceSceneId })
    case 'scene.rename':
      return actionsApplied({ type: 'SCENE_RENAME', sceneId: command.sceneId, name: command.name })
    case 'scene.setStart':
      return actionsApplied({ type: 'SCENE_SET_START', sceneId: command.sceneId })
    case 'scene.delete':
      return actionsApplied({ type: 'SCENE_DELETE', sceneId: command.sceneId })
    case 'scene.duplicate':
      return actionsApplied({ type: 'SCENE_DUPLICATE', sceneId: command.sceneId })
    case 'object.create':
      return actionsApplied(command.action)
    case 'scene.instance.addFromType':
      return actionsApplied({
        type: 'INSTANCE_ADD_FROM_TYPE',
        sceneId: command.sceneId,
        objectTypeId: command.objectTypeId,
      })
    case 'scene.instance.duplicate':
      return actionsApplied({
        type: 'INSTANCE_DUPLICATE',
        instanceId: command.instanceId,
        sceneId: command.sceneId,
      })
    case 'scene.instance.setVisible':
      return actionsApplied({
        type: 'ENTITY_SET_VISIBLE',
        entityId: command.entityId,
        visible: command.visible,
      })
    case 'scene.instance.rename':
      return actionsApplied({ type: 'ENTITY_SET_NAME', entityId: command.entityId, name: command.name })
    case 'objectType.rename':
      return actionsApplied({
        type: 'OBJECT_TYPE_RENAME',
        objectTypeId: command.objectTypeId,
        displayName: command.displayName,
      })
  }
}
