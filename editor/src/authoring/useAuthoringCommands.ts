import { useCallback, useMemo } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import {
  dispatchAuthoringCommand,
  type AuthoringCommand,
} from './command-dispatcher'
import type { ObjectCreateAction } from '../utils/object-create'
import type { AnimationClipDef, ImageAsset } from '../types'

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
