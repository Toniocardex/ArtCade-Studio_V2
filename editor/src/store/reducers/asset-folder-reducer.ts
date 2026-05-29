import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { AssetVirtualFolderDef } from '../../types'

export const assetFolderReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'ASSET_FOLDER_CREATE': {
      if (!state.project) return state
      const id = `folder_${Date.now().toString(36)}`
      const folder: AssetVirtualFolderDef = {
        id,
        name: action.name.trim() || 'New Folder',
        category: action.category,
        assetRefs: [],
      }
      return {
        ...state,
        project: {
          ...state.project,
          assetVirtualFolders: {
            ...(state.project.assetVirtualFolders ?? {}),
            [id]: folder,
          },
        },
        projectDirty: true,
      }
    }
    case 'ASSET_MOVE_TO_FOLDER': {
      const folders = state.project?.assetVirtualFolders
      const folder = folders?.[action.folderId]
      if (!state.project || !folder) return state
      const ref = { type: action.assetType, id: action.assetId } as const
      const without = Object.fromEntries(
        Object.entries(folders ?? {}).map(([fid, f]) => {
          if (fid === action.folderId) return [fid, f]
          return [
            fid,
            {
              ...f,
              assetRefs: f.assetRefs.filter(
                (r) => !(r.type === ref.type && r.id === ref.id),
              ),
            },
          ]
        }),
      )
      const target = without[action.folderId]
      if (target.assetRefs.some((r) => r.type === ref.type && r.id === ref.id)) {
        return { ...state, project: { ...state.project, assetVirtualFolders: without } }
      }
      return {
        ...state,
        project: {
          ...state.project,
          assetVirtualFolders: {
            ...without,
            [action.folderId]: { ...target, assetRefs: [...target.assetRefs, ref] },
          },
        },
        projectDirty: true,
      }
    }
    case 'ASSET_FOLDER_DELETE': {
      if (!state.project?.assetVirtualFolders?.[action.folderId]) return state
      const next = { ...state.project.assetVirtualFolders }
      delete next[action.folderId]
      return {
        ...state,
        project: { ...state.project, assetVirtualFolders: next },
        projectDirty: true,
      }
    }
    default:
      return state
  }
}
