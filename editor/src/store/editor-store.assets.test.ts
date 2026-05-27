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
        sprite: { spriteAssetId: 'assets/images/hero.png', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
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
    mode: 'canvas', consoleOpen: false, bottomPanelTab: 'assets', bottomPanelCollapsed: false, consoleAckUpToId: 0, editingTilesetId: null,
    openScripts: [], activeScriptPath: null, isPlaying: false,
    selectedTileCell: 1,
    editorGridSize: 32, snapToGrid: false, editorZoom: 1.0, editorZoomMode: 'manual', cameraPreview: false,
    projectLoadEpoch: 0,
    authoringMode: 'base',
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

  it('ENTITY_SET_SPRITE assigns tint rgb', () => {
    const s = coreReducer(st(project()), {
      type: 'ENTITY_SET_SPRITE',
      entityId: 1,
      sprite: {
        ...project().entities[1].sprite,
        tint: { x: 1, y: 0.5, z: 0, w: 1 },
      },
    })
    expect(s.project!.entities[1].sprite.tint).toEqual({ x: 1, y: 0.5, z: 0, w: 1 })
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

  it('round-trips imagePoints when present on an image asset', () => {
    const withPoints: ImageAsset = {
      ...IMG,
      imagePoints: [
        { id: 'muzzle', x: 0.75, y: 0.5 },
        { id: 'foot',   x: 0.5,  y: 1.0 },
      ],
    }
    const s = coreReducer(st(project()), { type: 'ASSET_ADD', asset: withPoints })
    const json = serializeProjectDoc(s.project!)
    expect(json).toContain('"imagePoints"')
    const again = parseProjectDoc(json)!
    expect(again.assets!['img_a'].imagePoints).toEqual(withPoints.imagePoints)
  })

  it('round-trips animation clips when present on an image asset', () => {
    const withClips: ImageAsset = {
      ...IMG,
      clips: [
        { name: 'idle', fps: 8, loop: true,
          frames: [{ x: 0, y: 0, w: 32, h: 32 }, { x: 32, y: 0, w: 32, h: 32 }] },
        { name: 'die', fps: 12, loop: false,
          frames: [{ x: 0, y: 32, w: 32, h: 32 }] },
      ],
    }
    const s = coreReducer(st(project()), { type: 'ASSET_ADD', asset: withClips })
    const json = serializeProjectDoc(s.project!)
    expect(json).toContain('"clips"')
    const again = parseProjectDoc(json)!
    expect(again.assets!['img_a'].clips).toEqual(withClips.clips)
  })

  it('parseAnimationClips drops malformed clips defensively', () => {
    const raw = JSON.stringify({
      projectName: 'D', version: '2.0.0', targetFPS: 60,
      activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
      entities: {}, scenes: { s: { id: 's', name: 'S', entityIds: [] } },
      assets: {
        a: {
          id: 'a', name: 'A', path: 'assets/images/a.png',
          clips: [
            { name: '', frames: [{ x: 0, y: 0, w: 1, h: 1 }] },   // no name
            { name: 'noframes', frames: [] },                      // empty frames
            { name: 'bad', frames: [{ x: 'nope' as unknown as number, y: 0, w: 1, h: 1 }] }, // NaN
            { name: 'ok', fps: -5, loop: false,                    // bad fps → default 12
              frames: [{ x: 0, y: 0, w: 32, h: 32 }] },
          ],
        },
      },
    })
    const p = parseProjectDoc(raw)!
    const clips = p.assets!['a'].clips!
    expect(clips).toHaveLength(1)
    expect(clips[0]).toEqual({
      name: 'ok', fps: 12, loop: false,
      frames: [{ x: 0, y: 0, w: 32, h: 32 }],
    })
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
