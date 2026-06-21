import { useCallback } from 'react'
import type { useAssetExplorerActions } from '../../hooks/useAssetExplorerActions'
import type { useAssetFolderActions } from '../../hooks/useAssetFolderActions'
import type {
  AssetVirtualFolderCategory,
  VirtualAssetRefType,
} from '../../utils/asset-virtual-folders'
import type { AssetFolderMenuHandlers } from './asset-folder-context-menus'
import type { ExplorerContextMenuItem } from './explorer-context-menu'

/**
 * Builds the asset library / virtual-folder context-menu item factories and the
 * per-asset folder menu handlers, sharing the import-label and import-trigger
 * logic. Extracted from ProjectExplorerPanel so the panel stays an orchestrator
 * and AssetsTreeSection can consume the menus directly.
 */
export function useAssetFolderMenus(
  assets: ReturnType<typeof useAssetExplorerActions>,
  assetFolders: ReturnType<typeof useAssetFolderActions>,
) {
  const makeAssetFolderMenuHandlers = useCallback(
    (
      category: AssetVirtualFolderCategory,
      type: VirtualAssetRefType,
      id: string,
    ): AssetFolderMenuHandlers => ({
      onMoveToFolder: (folderId) => assetFolders.moveAssetToFolder(folderId, type, id),
      onMoveRefsToFolder: (folderId, refs) =>
        assetFolders.moveRefsToFolder(folderId, refs, { source: 'context-menu' }),
      onUnassign: () => assetFolders.unassignAssetFromFolders(type, id, category),
      onUnassignRefs: (refs) =>
        assetFolders.unassignRefsFromFolders(refs, category, { source: 'context-menu' }),
      onCreateFolder: () => assetFolders.createVirtualFolder(category),
    }),
    [assetFolders],
  )

  const importLabelForAssetCategory = useCallback((category: AssetVirtualFolderCategory) => {
    switch (category) {
      case 'audio':
        return 'Import audio here'
      case 'fonts':
        return 'Import font here'
      case 'tilesets':
        return 'Import tileset here'
      case 'images':
        return 'Import image here'
    }
  }, [])

  const triggerAssetImportForCategory = useCallback(
    (category: AssetVirtualFolderCategory, folderId?: string) => {
      switch (category) {
        case 'audio':
          assets.triggerImportAudio(folderId ? { folderId } : undefined)
          break
        case 'fonts':
          assets.triggerImportFont(folderId ? { folderId } : undefined)
          break
        case 'tilesets':
          assets.triggerImportTileset(folderId ? { folderId } : undefined)
          break
        case 'images':
          break
      }
    },
    [assets.triggerImportAudio, assets.triggerImportFont, assets.triggerImportTileset],
  )

  const buildLibraryFolderMenuItems = useCallback(
    (category: AssetVirtualFolderCategory): readonly ExplorerContextMenuItem[] => {
      if (category === 'images') return []
      return [
        {
          id: `import-${category}`,
          label: importLabelForAssetCategory(category),
          onSelect: () => triggerAssetImportForCategory(category),
        },
        {
          id: `new-folder-${category}`,
          label: 'New folder...',
          onSelect: () => assetFolders.createVirtualFolder(category),
        },
      ]
    },
    [assetFolders, importLabelForAssetCategory, triggerAssetImportForCategory],
  )

  const buildVirtualFolderImportItems = useCallback(
    (
      category: AssetVirtualFolderCategory,
      folderId: string,
    ): readonly ExplorerContextMenuItem[] => {
      if (category === 'images') return []
      return [
        {
          id: `import-${folderId}`,
          label: importLabelForAssetCategory(category),
          onSelect: () => triggerAssetImportForCategory(category, folderId),
        },
      ]
    },
    [importLabelForAssetCategory, triggerAssetImportForCategory],
  )

  return {
    makeAssetFolderMenuHandlers,
    importLabelForAssetCategory,
    triggerAssetImportForCategory,
    buildLibraryFolderMenuItems,
    buildVirtualFolderImportItems,
  }
}
