import { useCallback } from 'react'
import { useEditorDispatch, useEditorSelector } from '../store/editor-store'
import { confirmDialog } from '../utils/native-dialog'
import { useTextPrompt } from './useTextPrompt'
import {
  isVirtualFolderNameTaken,
  virtualFoldersForCategory,
  VIRTUAL_ASSET_TYPE_TO_CATEGORY,
  type AssetVirtualFolderCategory,
  type VirtualAssetRefType,
} from '../utils/asset-virtual-folders'
import type { AssetDragRef } from '../utils/asset-explorer-dnd'

export function useAssetFolderActions() {
  const dispatch = useEditorDispatch()
  const promptText = useTextPrompt()
  const project = useEditorSelector((s) => s.project)

  const foldersForCategory = useCallback(
    (category: AssetVirtualFolderCategory) =>
      project ? virtualFoldersForCategory(project, category) : [],
    [project],
  )

  const createVirtualFolder = useCallback(
    (category: AssetVirtualFolderCategory) => {
      if (!project) return
      void promptText({
        title: 'New folder',
        message: `Folder name (${category}):`,
        defaultValue: 'New Folder',
      }).then((name) => {
        if (!name) return
        dispatch({ type: 'ASSET_FOLDER_CREATE', category, name })
      })
    },
    [dispatch, project, promptText],
  )

  const renameVirtualFolder = useCallback(
    (folderId: string) => {
      const folder = project?.assetVirtualFolders?.[folderId]
      if (!project || !folder) return

      const promptRename = (message: string, defaultValue: string) => {
        void promptText({
          title: 'Rename folder',
          message,
          defaultValue,
        }).then((name) => {
          if (!name) return
          const trimmed = name.trim() || 'New Folder'
          if (trimmed === folder.name) return
          if (isVirtualFolderNameTaken(project, folder.category, trimmed, folderId)) {
            promptRename(
              `A folder named "${trimmed}" already exists in ${folder.category}. Choose another name:`,
              trimmed,
            )
            return
          }
          dispatch({ type: 'ASSET_FOLDER_RENAME', folderId, name: trimmed })
        })
      }

      promptRename(`Folder name (${folder.category}):`, folder.name)
    },
    [dispatch, project, promptText],
  )

  const moveAssetToFolder = useCallback(
    (folderId: string, assetType: VirtualAssetRefType, assetId: string) => {
      if (!project) return
      dispatch({ type: 'ASSET_MOVE_TO_FOLDER', folderId, assetType, assetId })
    },
    [dispatch, project],
  )

  const unassignAssetFromFolders = useCallback(
    (assetType: VirtualAssetRefType, assetId: string) => {
      if (!project) return
      dispatch({ type: 'ASSET_UNASSIGN_FROM_FOLDERS', assetType, assetId })
    },
    [dispatch, project],
  )

  const moveRefsToFolder = useCallback(
    (folderId: string, refs: readonly AssetDragRef[]) => {
      const folder = project?.assetVirtualFolders?.[folderId]
      if (!project || !folder || refs.length === 0) return
      for (const ref of refs) {
        if (VIRTUAL_ASSET_TYPE_TO_CATEGORY[ref.type] !== folder.category) continue
        dispatch({ type: 'ASSET_MOVE_TO_FOLDER', folderId, assetType: ref.type, assetId: ref.id })
      }
    },
    [dispatch, project],
  )

  const unassignRefsFromFolders = useCallback(
    (refs: readonly AssetDragRef[]) => {
      if (!project || refs.length === 0) return
      for (const ref of refs) {
        dispatch({ type: 'ASSET_UNASSIGN_FROM_FOLDERS', assetType: ref.type, assetId: ref.id })
      }
    },
    [dispatch, project],
  )

  const deleteVirtualFolder = useCallback(
    (folderId: string, folderName: string) => {
      if (!project?.assetVirtualFolders?.[folderId]) return
      void confirmDialog(
        `Delete virtual folder "${folderName}"? Assets stay in the library.`,
        { title: 'Delete folder', kind: 'warning' },
      ).then((ok) => {
        if (!ok) return
        dispatch({ type: 'ASSET_FOLDER_DELETE', folderId })
      })
    },
    [dispatch, project],
  )

  return {
    foldersForCategory,
    createVirtualFolder,
    renameVirtualFolder,
    moveAssetToFolder,
    moveRefsToFolder,
    unassignAssetFromFolders,
    unassignRefsFromFolders,
    deleteVirtualFolder,
  }
}
