import { describe, expect, it } from 'vitest'
import type { ProjectDoc } from '../types'
import {
  validateVirtualAssetMoveToFolder,
  validateVirtualAssetUnassign,
} from './asset-virtual-move-validation'

function baseProject(): ProjectDoc {
  return {
    version: 2,
    name: 'test',
    activeSceneId: 'scene_1',
    entities: {},
    scenes: {},
    assets: { img1: { id: 'img1', name: 'a.png', path: 'a.png' } },
    assetVirtualFolders: {
      folder_1: {
        id: 'folder_1',
        name: 'Folder A',
        category: 'images',
        assetRefs: [],
      },
      folder_2: {
        id: 'folder_2',
        name: 'Folder B',
        category: 'images',
        assetRefs: [{ type: 'image', id: 'img1' }],
      },
    },
  } as unknown as ProjectDoc
}

describe('asset-virtual-move-validation', () => {
  it('rejects move when target folder is missing', () => {
    const project = baseProject()
    const result = validateVirtualAssetMoveToFolder(project, 'missing', [
      { type: 'image', id: 'img1' },
    ])
    expect(result).toEqual({ ok: false, reason: 'TARGET_NOT_FOUND' })
  })

  it('rejects move when asset is already in target folder', () => {
    const project = baseProject()
    const result = validateVirtualAssetMoveToFolder(project, 'folder_2', [
      { type: 'image', id: 'img1' },
    ])
    expect(result).toEqual({ ok: false, reason: 'SAME_FOLDER' })
  })

  it('accepts move from root into virtual folder', () => {
    const project = baseProject()
    const result = validateVirtualAssetMoveToFolder(project, 'folder_1', [
      { type: 'image', id: 'img1' },
    ])
    expect(result).toEqual({ ok: true })
  })

  it('rejects unassign when asset is not in a virtual folder', () => {
    const project = baseProject()
    delete project.assetVirtualFolders!.folder_2
    const result = validateVirtualAssetUnassign(project, 'images', [
      { type: 'image', id: 'img1' },
    ])
    expect(result).toEqual({ ok: false, reason: 'NOT_IN_FOLDER' })
  })
})
