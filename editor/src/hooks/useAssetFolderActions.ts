import { useCallback } from 'react'
import { useEditorSelector } from '../store/editor-store'
import { confirmDialog } from '../utils/native-dialog'
import { useTextPrompt } from './useTextPrompt'
import { useAuthoringCommands } from '../authoring/useAuthoringCommands'
import {
  isVirtualFolderNameTaken,
  virtualFoldersForCategory,
  imageVirtualFoldersForUsage,
  type AssetVirtualFolderCategory,
  type VirtualAssetRefType,
} from '../utils/asset-virtual-folders'
import type { ImageAssetUsage } from '../types'
import type { AssetDragRef, AssetMoveSource } from '../utils/asset-explorer-dnd'
import {
  validateVirtualAssetMoveToFolder,
  validateVirtualAssetUnassign,
} from '../utils/asset-virtual-move-validation'

export type { AssetMoveSource }

export function useAssetFolderActions() {
  const authoring = useAuthoringCommands()
  const promptText = useTextPrompt()
  const project = useEditorSelector((s) => s.project)

  const foldersForCategory = useCallback(
    (category: AssetVirtualFolderCategory) =>
      project ? virtualFoldersForCategory(project, category) : [],
    [project],
  )

  const imageFoldersForUsage = useCallback(
    (usage: ImageAssetUsage) =>
      project ? imageVirtualFoldersForUsage(project, usage) : [],
    [project],
  )

  const createVirtualFolder = useCallback(
    (category: AssetVirtualFolderCategory, usage?: ImageAssetUsage) => {
      if (!project) return
      void promptText({
        title: 'New folder',
        message: `Folder name (${usage ?? category}):`,
        defaultValue: 'New Folder',
      }).then((name) => {
        if (!name) return
        authoring.createAssetFolder(category, name, usage)
      })
    },
    [authoring, project, promptText],
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
          if (isVirtualFolderNameTaken(project, folder.category, trimmed, folder.usage, folderId)) {
            promptRename(
              `A folder named "${trimmed}" already exists in ${folder.category}. Choose another name:`,
              trimmed,
            )
            return
          }
          authoring.renameAssetFolder(folderId, trimmed)
        })
      }

      promptRename(`Folder name (${folder.category}):`, folder.name)
    },
    [authoring, project, promptText],
  )

  const moveRefsToFolder = useCallback(
    (
      folderId: string,
      refs: readonly AssetDragRef[],
      _options: { source: AssetMoveSource } = { source: 'context-menu' },
    ) => {
      if (!project) return
      const validation = validateVirtualAssetMoveToFolder(project, folderId, refs)
      if (!validation.ok) return
      for (const ref of refs) {
        authoring.moveAssetToFolder(folderId, ref.type, ref.id)
      }
    },
    [authoring, project],
  )

  const moveRefsToImageUsage = useCallback(
    (
      usage: ImageAssetUsage,
      refs: readonly AssetDragRef[],
      _options: { source: AssetMoveSource } = { source: 'context-menu' },
    ) => {
      if (!project) return
      for (const ref of refs) {
        if (ref.type !== 'image' || !project.assets?.[ref.id]) continue
        authoring.setImageAssetUsage(ref.id, usage)
      }
    },
    [authoring, project],
  )

  const moveAssetToFolder = useCallback(
    (folderId: string, assetType: VirtualAssetRefType, assetId: string) => {
      moveRefsToFolder(folderId, [{ type: assetType, id: assetId }], { source: 'context-menu' })
    },
    [moveRefsToFolder],
  )

  const unassignRefsFromFolders = useCallback(
    (
      refs: readonly AssetDragRef[],
      category: AssetVirtualFolderCategory,
      _options: { source: AssetMoveSource } = { source: 'context-menu' },
    ) => {
      if (!project) return
      const validation = validateVirtualAssetUnassign(project, category, refs)
      if (!validation.ok) return
      for (const ref of refs) {
        authoring.unassignAssetFromFolders(ref.type, ref.id)
      }
    },
    [authoring, project],
  )

  const unassignAssetFromFolders = useCallback(
    (assetType: VirtualAssetRefType, assetId: string, category: AssetVirtualFolderCategory) => {
      unassignRefsFromFolders([{ type: assetType, id: assetId }], category, {
        source: 'context-menu',
      })
    },
    [unassignRefsFromFolders],
  )

  const deleteVirtualFolder = useCallback(
    (folderId: string, folderName: string) => {
      if (!project?.assetVirtualFolders?.[folderId]) return
      void confirmDialog(
        `Delete virtual folder "${folderName}"? Assets stay in the library.`,
        { title: 'Delete folder', kind: 'warning' },
      ).then((ok) => {
        if (!ok) return
        authoring.deleteAssetFolder(folderId)
      })
    },
    [authoring, project],
  )

  return {
    foldersForCategory,
    imageFoldersForUsage,
    createVirtualFolder,
    renameVirtualFolder,
    moveAssetToFolder,
    moveRefsToFolder,
    moveRefsToImageUsage,
    unassignAssetFromFolders,
    unassignRefsFromFolders,
    deleteVirtualFolder,
  }
}
