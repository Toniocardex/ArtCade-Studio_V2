import { describe, expect, it } from 'vitest'
import { coreReducer, initialCoreState } from './editor-store'
import { createBlankProject } from '../utils/project-factory'

function st() {
  return { ...initialCoreState, project: createBlankProject(), projectDirty: false }
}

describe('asset-folder-reducer', () => {
  it('ASSET_FOLDER_CREATE adds an empty virtual folder', () => {
    const next = coreReducer(st(), {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      name: 'Sprites',
    })
    const folders = Object.values(next.project!.assetVirtualFolders ?? {})
    expect(folders).toHaveLength(1)
    expect(folders[0].name).toBe('Sprites')
    expect(folders[0].category).toBe('images')
    expect(next.projectDirty).toBe(true)
  })

  it('ASSET_MOVE_TO_FOLDER places asset only in target folder', () => {
    const base = st()
    base.project!.assets = {
      img1: { id: 'img1', name: 'Hero', path: 'assets/images/hero.png' },
    }
    let s = coreReducer(base, {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      name: 'A',
    })
    const folderA = Object.values(s.project!.assetVirtualFolders!).find((f) => f.name === 'A')!.id
    s = coreReducer(s, {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      name: 'B',
    })
    const folderB = Object.values(s.project!.assetVirtualFolders!).find((f) => f.name === 'B')!.id
    s = coreReducer(s, {
      type: 'ASSET_MOVE_TO_FOLDER',
      folderId: folderA,
      assetType: 'image',
      assetId: 'img1',
    })
    s = coreReducer(s, {
      type: 'ASSET_MOVE_TO_FOLDER',
      folderId: folderB,
      assetType: 'image',
      assetId: 'img1',
    })
    const a = s.project!.assetVirtualFolders![folderA]
    const b = s.project!.assetVirtualFolders![folderB]
    expect(a.assetRefs).toHaveLength(0)
    expect(b.assetRefs).toEqual([{ type: 'image', id: 'img1' }])
  })

  it('ASSET_UNASSIGN_FROM_FOLDERS removes asset from all virtual folders', () => {
    let s = coreReducer(st(), {
      type: 'ASSET_FOLDER_CREATE',
      category: 'audio',
      name: 'SFX',
    })
    const folderId = Object.keys(s.project!.assetVirtualFolders!)[0]
    s = coreReducer(s, {
      type: 'ASSET_MOVE_TO_FOLDER',
      folderId,
      assetType: 'audio',
      assetId: 'aud1',
    })
    s = coreReducer(s, {
      type: 'ASSET_UNASSIGN_FROM_FOLDERS',
      assetType: 'audio',
      assetId: 'aud1',
    })
    expect(s.project!.assetVirtualFolders![folderId].assetRefs).toHaveLength(0)
  })

  it('ASSET_FOLDER_DELETE removes folder entry only', () => {
    let s = coreReducer(st(), {
      type: 'ASSET_FOLDER_CREATE',
      category: 'tilesets',
      name: 'Tiles',
    })
    const folderId = Object.keys(s.project!.assetVirtualFolders!)[0]
    s = coreReducer(s, {
      type: 'ASSET_MOVE_TO_FOLDER',
      folderId,
      assetType: 'tileset',
      assetId: 'ts1',
    })
    s = coreReducer(s, { type: 'ASSET_FOLDER_DELETE', folderId })
    expect(s.project!.assetVirtualFolders![folderId]).toBeUndefined()
  })

  it('ASSET_MOVE_TO_FOLDER is idempotent when asset already in folder', () => {
    let s = coreReducer(st(), {
      type: 'ASSET_FOLDER_CREATE',
      category: 'fonts',
      name: 'UI',
    })
    const folderId = Object.keys(s.project!.assetVirtualFolders!)[0]
    s = coreReducer(s, {
      type: 'ASSET_MOVE_TO_FOLDER',
      folderId,
      assetType: 'font',
      assetId: 'font1',
    })
    const before = s.project!.assetVirtualFolders![folderId].assetRefs
    s = coreReducer(s, {
      type: 'ASSET_MOVE_TO_FOLDER',
      folderId,
      assetType: 'font',
      assetId: 'font1',
    })
    expect(s.project!.assetVirtualFolders![folderId].assetRefs).toEqual(before)
  })
})
