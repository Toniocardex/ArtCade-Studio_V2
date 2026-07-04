import { useCallback, useMemo } from 'react'
import { useEditorDispatch } from '../store/editor-store'
import {
  dispatchAuthoringCommand,
  type AuthoringCommand,
} from './command-dispatcher'
import type { ObjectCreateAction } from '../utils/object-create'

export function useAuthoringCommands() {
  const dispatch = useEditorDispatch()

  const run = useCallback(
    (command: AuthoringCommand) =>
      dispatchAuthoringCommand(command, { dispatch }),
    [dispatch],
  )

  return useMemo(() => ({
    dispatchAuthoringCommand: run,
    renameProject: (name: string) => run({ type: 'project.rename', name }),
    deleteAsset: (
      kind: 'image' | 'audio' | 'font' | 'tileset',
      assetId: string,
    ) => run({ type: 'asset.delete', kind, assetId }),
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
