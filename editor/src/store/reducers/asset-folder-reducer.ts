import type { CoreState, Action, DomainReducer } from '../editor-store-state'
import type { AssetVirtualFolderDef, ImageAssetUsage, ProjectDoc } from '../../types'
import {
  isVirtualFolderNameTaken,
  uniqueVirtualFolderName,
} from '../../utils/asset-virtual-folders'
import { detachImageAssetFromSprites } from '../../utils/sprite-asset-ref'

function nextVirtualFolderId(folders: Record<string, AssetVirtualFolderDef> | undefined): string {
  let max = 0
  for (const id of Object.keys(folders ?? {})) {
    const m = /^folder_(\d+)$/.exec(id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `folder_${max + 1}`
}

function stripImageFromFolders(
  folders: Record<string, AssetVirtualFolderDef> | undefined,
  assetId: string,
): Record<string, AssetVirtualFolderDef> | undefined {
  if (!folders) return folders
  return Object.fromEntries(
    Object.entries(folders).map(([fid, f]) => [
      fid,
      {
        ...f,
        assetRefs: f.assetRefs.filter((r) => !(r.type === 'image' && r.id === assetId)),
      },
    ]),
  )
}

function detachImageFromSprites(project: ProjectDoc, assetId: string, path: string): ProjectDoc {
  return detachImageAssetFromSprites(project, { id: assetId, path })
}

function setImageUsage(
  project: ProjectDoc,
  assetId: string,
  usage: ImageAssetUsage,
  folderId?: string,
): ProjectDoc {
  const asset = project.assets?.[assetId]
  if (!asset) return project
  let folders = stripImageFromFolders(project.assetVirtualFolders, assetId)
  if (folderId) {
    const folder = folders?.[folderId]
    if (folder?.category === 'images' && folder.usage === usage) {
      folders = {
        ...folders,
        [folderId]: {
          ...folder,
          assetRefs: [...folder.assetRefs, { type: 'image', id: assetId }],
        },
      }
    }
  }
  const next: ProjectDoc = {
    ...project,
    assets: {
      ...(project.assets ?? {}),
      [assetId]: { ...asset, usage },
    },
    ...(folders ? { assetVirtualFolders: folders } : {}),
  }
  return usage === 'sprite' ? next : detachImageFromSprites(next, assetId, asset.path)
}

export const assetFolderReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'IMAGE_ASSET_RENAME': {
      const asset = state.project?.assets?.[action.assetId]
      const name = action.name.trim()
      if (!state.project || !asset || !name || name === asset.name) return state
      return {
        ...state,
        project: {
          ...state.project,
          assets: {
            ...state.project.assets,
            [action.assetId]: { ...asset, name },
          },
        },
        projectDirty: true,
      }
    }
    case 'AUDIO_ASSET_RENAME': {
      const asset = state.project?.audioAssets?.[action.assetId]
      const name = action.name.trim()
      if (!state.project || !asset || !name || name === asset.name) return state
      return {
        ...state,
        project: {
          ...state.project,
          audioAssets: {
            ...state.project.audioAssets,
            [action.assetId]: { ...asset, name },
          },
        },
        projectDirty: true,
      }
    }
    case 'FONT_ASSET_RENAME': {
      const asset = state.project?.fontAssets?.[action.assetId]
      const name = action.name.trim()
      if (!state.project || !asset || !name || name === asset.name) return state
      return {
        ...state,
        project: {
          ...state.project,
          fontAssets: {
            ...state.project.fontAssets,
            [action.assetId]: { ...asset, name },
          },
        },
        projectDirty: true,
      }
    }
    case 'TILESET_ASSET_RENAME': {
      const asset = state.project?.tilesets?.[action.assetId]
      const name = action.name.trim()
      if (!state.project || !asset || !name || name === asset.name) return state
      return {
        ...state,
        project: {
          ...state.project,
          tilesets: {
            ...state.project.tilesets,
            [action.assetId]: { ...asset, name },
          },
        },
        projectDirty: true,
      }
    }
    case 'ASSET_FOLDER_CREATE': {
      if (!state.project) return state
      if (action.category === 'images' && !action.usage) return state
      const id = nextVirtualFolderId(state.project.assetVirtualFolders)
      const folder: AssetVirtualFolderDef = {
        id,
        name: uniqueVirtualFolderName(
          state.project,
          action.category,
          action.name,
          action.usage,
        ),
        category: action.category,
        ...(action.category === 'images' ? { usage: action.usage } : {}),
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
      if (folder.category === 'images' && action.assetType === 'image' && folder.usage) {
        return {
          ...state,
          project: setImageUsage(state.project, action.assetId, folder.usage, action.folderId),
          projectDirty: true,
        }
      }
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
      if (isVirtualFolderNameTaken(state.project, folder.category, name, folder.usage, action.folderId)) {
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
    case 'IMAGE_ASSET_SET_USAGE': {
      const project = state.project
      if (!project?.assets?.[action.assetId]) return state
      return {
        ...state,
        project: setImageUsage(project, action.assetId, action.usage, action.folderId),
        projectDirty: true,
      }
    }
    default:
      return state
  }
}
