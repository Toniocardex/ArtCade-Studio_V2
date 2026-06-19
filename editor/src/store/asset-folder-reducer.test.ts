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
      usage: 'sprite',
      name: 'Sprites',
    })
    const folders = Object.values(next.project!.assetVirtualFolders ?? {})
    expect(folders).toHaveLength(1)
    expect(folders[0].name).toBe('Sprites')
    expect(folders[0].category).toBe('images')
    expect(folders[0].usage).toBe('sprite')
    expect(next.projectDirty).toBe(true)
  })

  it('ASSET_MOVE_TO_FOLDER places asset only in target folder', () => {
    const base = st()
    base.project!.assets = {
      img1: { id: 'img1', name: 'Hero', path: 'assets/images/hero.png', usage: 'sprite' },
    }
    let s = coreReducer(base, {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      usage: 'sprite',
      name: 'A',
    })
    const folderA = Object.values(s.project!.assetVirtualFolders!).find((f) => f.name === 'A')!.id
    s = coreReducer(s, {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      usage: 'sprite',
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

  it('ASSET_FOLDER_CREATE dedupes name within category', () => {
    let s = coreReducer(st(), {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      usage: 'sprite',
      name: 'New Folder',
    })
    s = coreReducer(s, {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      usage: 'sprite',
      name: 'New Folder',
    })
    const names = Object.values(s.project!.assetVirtualFolders ?? {}).map((f) => f.name)
    expect(names).toEqual(['New Folder', 'New Folder 2'])
  })

  it('ASSET_FOLDER_CREATE scopes duplicate image folder names by usage', () => {
    let s = coreReducer(st(), {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      usage: 'sprite',
      name: 'Hero',
    })
    s = coreReducer(s, {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      usage: 'background',
      name: 'Hero',
    })
    const folders = Object.values(s.project!.assetVirtualFolders ?? {})
    expect(folders.map((f) => `${f.usage}:${f.name}`)).toEqual([
      'sprite:Hero',
      'background:Hero',
    ])
  })

  it('ASSET_FOLDER_RENAME updates display name when unique', () => {
    let s = coreReducer(st(), {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      usage: 'sprite',
      name: 'Sprites',
    })
    const folderId = Object.keys(s.project!.assetVirtualFolders!)[0]
    s = coreReducer(s, {
      type: 'ASSET_FOLDER_RENAME',
      folderId,
      name: 'Characters',
    })
    expect(s.project!.assetVirtualFolders![folderId].name).toBe('Characters')
    expect(s.projectDirty).toBe(true)
  })

  it('ASSET_FOLDER_RENAME rejects duplicate names in category', () => {
    let s = coreReducer(st(), {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      usage: 'sprite',
      name: 'A',
    })
    s = coreReducer(s, {
      type: 'ASSET_FOLDER_CREATE',
      category: 'images',
      usage: 'sprite',
      name: 'B',
    })
    const folderB = Object.values(s.project!.assetVirtualFolders!).find((f) => f.name === 'B')!.id
    s = coreReducer(s, {
      type: 'ASSET_FOLDER_RENAME',
      folderId: folderB,
      name: 'A',
    })
    expect(s.project!.assetVirtualFolders![folderB].name).toBe('B')
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
