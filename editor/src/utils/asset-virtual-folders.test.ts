import { describe, expect, it } from 'vitest'
import { createBlankProject } from './project-factory'
import {
  isVirtualFolderNameTaken,
  uniqueVirtualFolderName,
} from './asset-virtual-folders'

describe('virtual folder names', () => {
  it('uniqueVirtualFolderName auto-suffixes within category', () => {
    const project = createBlankProject()
    project.assetVirtualFolders = {
      folder_1: {
        id: 'folder_1',
        name: 'New Folder',
        category: 'images',
        assetRefs: [],
      },
    }
    expect(uniqueVirtualFolderName(project, 'images', 'New Folder')).toBe('New Folder 2')
    expect(uniqueVirtualFolderName(project, 'tilesets', 'New Folder')).toBe('New Folder')
  })

  it('isVirtualFolderNameTaken is case-insensitive per category', () => {
    const project = createBlankProject()
    project.assetVirtualFolders = {
      folder_1: {
        id: 'folder_1',
        name: 'Sprites',
        category: 'images',
        assetRefs: [],
      },
    }
    expect(isVirtualFolderNameTaken(project, 'images', 'sprites')).toBe(true)
    expect(isVirtualFolderNameTaken(project, 'images', 'sprites', 'folder_1')).toBe(false)
    expect(isVirtualFolderNameTaken(project, 'audio', 'Sprites')).toBe(false)
  })
})
