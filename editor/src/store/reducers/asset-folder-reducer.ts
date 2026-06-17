import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { AssetVirtualFolderDef } from '../../types'
import {
  isVirtualFolderNameTaken,
  uniqueVirtualFolderName,
} from '../../utils/asset-virtual-folders'

function nextVirtualFolderId(folders: Record<string, AssetVirtualFolderDef> | undefined): string {
  let max = 0
  for (const id of Object.keys(folders ?? {})) {
    const m = /^folder_(\d+)$/.exec(id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `folder_${max + 1}`
}

export const assetFolderReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'ASSET_FOLDER_CREATE': {
      if (!state.project) return state
      const id = nextVirtualFolderId(state.project.assetVirtualFolders)
      const folder: AssetVirtualFolderDef = {
        id,
        name: uniqueVirtualFolderName(state.project, action.category, action.name),
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
      const stripped = Object.fromEntries(
        Object.entries(folders ?? {}).map(([fid, f]) => [
          fid,
          {
            ...f,
            assetRefs: f.assetRefs.filter(
              (r) => !(r.type === ref.type && r.id === ref.id),
            ),
          },
        ]),
      )
      const target = stripped[action.folderId]
      if (target.assetRefs.some((r) => r.type === ref.type && r.id === ref.id)) {
        return { ...state, project: { ...state.project, assetVirtualFolders: stripped } }
      }
      return {
        ...state,
        project: {
          ...state.project,
          assetVirtualFolders: {
            ...stripped,
            [action.folderId]: { ...target, assetRefs: [...target.assetRefs, ref] },
          },
        },
        projectDirty: true,
      }
    }
    case 'ASSET_UNASSIGN_FROM_FOLDERS': {
      const folders = state.project?.assetVirtualFolders
      if (!state.project || !folders) return state
      const ref = { type: action.assetType, id: action.assetId } as const
      const next = Object.fromEntries(
        Object.entries(folders).map(([fid, f]) => [
          fid,
          {
            ...f,
            assetRefs: f.assetRefs.filter(
              (r) => !(r.type === ref.type && r.id === ref.id),
            ),
          },
        ]),
      )
      return {
        ...state,
        project: { ...state.project, assetVirtualFolders: next },
        projectDirty: true,
      }
    }
    case 'ASSET_FOLDER_RENAME': {
      const folder = state.project?.assetVirtualFolders?.[action.folderId]
      if (!state.project || !folder) return state
      const name = action.name.trim() || 'New Folder'
      if (name === folder.name) return state
      if (isVirtualFolderNameTaken(state.project, folder.category, name, action.folderId)) {
        return state
      }
      return {
        ...state,
        project: {
          ...state.project,
          assetVirtualFolders: {
            ...state.project.assetVirtualFolders,
            [action.folderId]: { ...folder, name },
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
