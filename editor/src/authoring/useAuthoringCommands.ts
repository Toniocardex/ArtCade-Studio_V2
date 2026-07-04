import { useCallback, useMemo } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import {
  dispatchAuthoringCommand,
} from './command-dispatcher'
import type { AuthoringCommand } from './commands'
import type { ObjectCreateAction } from '../utils/object-create'
import type {
  AnimationClipDef,
  AssetFolderCategory,
  AudioAsset,
  FontAsset,
  ImageAsset,
  ImageAssetUsage,
} from '../types'
import type { TilesetAsset } from '../types/tilemap'
import type { AssetRefKind } from './commands/assets'

export function useAuthoringCommands() {
  const dispatch = useEditorDispatch()
  const project = useEditorSelector((s) => s.project)

  const run = useCallback(
    (command: AuthoringCommand) =>
      dispatchAuthoringCommand(command, { dispatch, project }),
    [dispatch, project],
  )

  return useMemo(() => ({
    dispatchAuthoringCommand: run,
    renameProject: (name: string) => run({ type: 'project.rename', name }),
    deleteAsset: (
      kind: 'image' | 'audio' | 'font' | 'tileset',
      assetId: string,
    ) => run({ type: 'asset.delete', kind, assetId }),
    upsertImageAsset: (asset: ImageAsset) =>
      run({ type: 'asset.image.upsert', asset }),
    upsertAudioAsset: (asset: AudioAsset) =>
      run({ type: 'asset.audio.upsert', asset }),
    upsertFontAsset: (asset: FontAsset) =>
      run({ type: 'asset.font.upsert', asset }),
    upsertTilesetAsset: (asset: TilesetAsset) =>
      run({ type: 'asset.tileset.upsert', asset }),
    renameAsset: (
      kind: 'image' | 'audio' | 'font' | 'tileset',
      assetId: string,
      name: string,
    ) => run({ type: 'asset.rename', kind, assetId, name }),
    patchImageAsset: (assetId: string, patch: Partial<ImageAsset>) =>
      run({ type: 'asset.image.patch', assetId, patch }),
    setImageAssetClips: (
      assetId: string,
      clips: AnimationClipDef[],
      coalesceKey?: string,
    ) => run({ type: 'asset.image.setClips', assetId, clips, coalesceKey }),
    createAssetFolder: (
      category: AssetFolderCategory,
      name: string,
      usage?: ImageAssetUsage,
    ) => run({ type: 'asset.folder.create', category, name, usage }),
    renameAssetFolder: (folderId: string, name: string) =>
      run({ type: 'asset.folder.rename', folderId, name }),
    moveAssetToFolder: (folderId: string, assetType: AssetRefKind, assetId: string) =>
      run({ type: 'asset.folder.moveAsset', folderId, assetType, assetId }),
    unassignAssetFromFolders: (assetType: AssetRefKind, assetId: string) =>
      run({ type: 'asset.folder.unassignAsset', assetType, assetId }),
    deleteAssetFolder: (folderId: string) =>
      run({ type: 'asset.folder.delete', folderId }),
    setImageAssetUsage: (assetId: string, usage: ImageAssetUsage) =>
      run({ type: 'asset.image.setUsage', assetId, usage }),
    addScene: (sourceSceneId?: string) =>
      run({ type: 'scene.addEmpty', sourceSceneId }),
    renameScene: (sceneId: string, name: string) =>
      run({ type: 'scene.rename', sceneId, name }),
    setStartScene: (sceneId: string) =>
      run({ type: 'scene.setStart', sceneId }),
    deleteScene: (sceneId: string) =>
      run({ type: 'scene.delete', sceneId }),
    duplicateScene: (sceneId: string) =>
      run({ type: 'scene.duplicate', sceneId }),
    createObject: (action: ObjectCreateAction) =>
      run({ type: 'object.create', action }),
    addInstanceFromType: (sceneId: string, objectTypeId: string) =>
      run({ type: 'scene.instance.addFromType', sceneId, objectTypeId }),
    duplicateInstance: (sceneId: string, instanceId: number) =>
      run({ type: 'scene.instance.duplicate', sceneId, instanceId }),
    setInstanceVisible: (entityId: number, visible: boolean) =>
      run({ type: 'scene.instance.setVisible', entityId, visible }),
    renameInstance: (entityId: number, name: string) =>
      run({ type: 'scene.instance.rename', entityId, name }),
    renameObjectType: (objectTypeId: string, displayName: string) =>
      run({ type: 'objectType.rename', objectTypeId, displayName }),
  }), [run])
}
