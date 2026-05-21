import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from './editor-store'
import { parseProjectDoc, serializeProjectDoc } from '../utils/project'
import type { ProjectDoc, ImageAsset } from '../types'

const IMG: ImageAsset = {
  id: 'img_a', name: 'hero.png', path: 'assets/images/hero.png',
  dataUrl: 'data:image/png;base64,AAAA',
}

function project(): ProjectDoc {
  return {
    projectName: 'T', version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1, name: 'A', className: 'Player', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: 'assets/images/hero.png', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
    },
    scenes: {
      s: { id: 's', name: 'S', worldSize: { x: 640, y: 320 }, viewportSize: { x: 640, y: 320 }, backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1] },
    },
  }
}
function st(p: ProjectDoc): CoreState {
  return {
    project: p, projectPath: null, projectDirty: false,
    selection: { entityId: 1, sceneId: 's' },
    mode: 'canvas', bottomTab: 'assets',
    openScripts: [], activeScriptPath: null, isPlaying: false,
    selectedTileCell: 1,
    editorGridSize: 32, snapToGrid: false, editorZoom: 1.0, cameraPreview: false,
    projectLoadEpoch: 0,
  }
}

describe('coreReducer — image asset library', () => {
  it('ASSET_ADD stores the asset, marks dirty', () => {
    const s = coreReducer(st(project()), { type: 'ASSET_ADD', asset: IMG })
    expect(s.project!.assets!['img_a']).toEqual(IMG)
    expect(s.projectDirty).toBe(true)
  })

  it('ENTITY_SET_SPRITE assigns spriteAssetId', () => {
    const s = coreReducer(st(project()), {
      type: 'ENTITY_SET_SPRITE', entityId: 1,
      sprite: { ...project().entities[1].sprite, spriteAssetId: 'assets/images/x.png' },
    })
    expect(s.project!.entities[1].sprite.spriteAssetId).toBe('assets/images/x.png')
    expect(s.projectDirty).toBe(true)
  })

  it('ASSET_REMOVE deletes it and detaches the sprite from entities', () => {
    let s = coreReducer(st(project()), { type: 'ASSET_ADD', asset: IMG })
    s = coreReducer(s, { type: 'ASSET_REMOVE', assetId: 'img_a' })
    expect(s.project!.assets).toEqual({})
    expect(s.project!.entities[1].sprite.spriteAssetId).toBe('')
  })

  it('no-op without a project', () => {
    const s = coreReducer({ ...st(project()), project: null },
      { type: 'ASSET_ADD', asset: IMG })
    expect(s.project).toBeNull()
    expect(s.projectDirty).toBe(false)
  })
})

describe('project.json roundtrip — assets', () => {
  it('serialize drops transient dataUrl, parse restores id/name/path', () => {
    const s = coreReducer(st(project()), { type: 'ASSET_ADD', asset: IMG })
    const json = serializeProjectDoc(s.project!)
    expect(json).toContain('"assets"')
    expect(json).not.toContain('dataUrl')
    const again = parseProjectDoc(json)!
    expect(again.assets!['img_a']).toEqual({
      id: 'img_a', name: 'hero.png', path: 'assets/images/hero.png',
    })
  })

  it('omits assets when absent', () => {
    const plain = serializeProjectDoc(project())
    expect(plain).not.toContain('"assets"')
  })

  it('parseAssets is defensive (skips entries without a path)', () => {
    const raw = JSON.stringify({
      projectName: 'D', version: '2.0.0',
      targetFPS: 60, activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
      entities: {}, scenes: { s: { id: 's', name: 'S', entityIds: [] } },
      assets: { bad: { id: 'bad', name: 'x' }, ok: { id: 'ok', name: 'OK', path: 'assets/images/o.png' } },
    })
    const p = parseProjectDoc(raw)!
    expect(p.assets!['ok'].path).toBe('assets/images/o.png')
    expect(p.assets!['bad']).toBeUndefined()
  })
})
