import { useCallback, useMemo } from 'react'
import { useEditorDispatch } from '../store/editor-store'
import {
  dispatchAuthoringCommand,
  type AuthoringCommand,
} from './command-dispatcher'

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
  }), [run])
}
