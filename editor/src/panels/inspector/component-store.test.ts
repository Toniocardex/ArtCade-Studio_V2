import { describe, it, expect } from 'vitest'
import { coreReducer, type CoreState } from '../../store/editor-store'
import { parseProjectDoc, serializeProjectDoc } from '../../utils/project'
import type { ProjectDoc, EntityDef } from '../../types'

function entity(): EntityDef {
  return {
    id: 1, name: 'Hero', className: 'Player', tags: ['player'],
    transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
    sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
  }
}
function project(): ProjectDoc {
  return {
    projectName: 'T', version: '2.0.0',
    gameResolution: { x: 1280, y: 720 }, targetFPS: 60,
    activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
    entities: { 1: entity() },
    scenes: { s: { id: 's', name: 'S', worldSize: { x: 1280, y: 720 }, viewportSize: { x: 1280, y: 720 }, backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1] } },
  }
}
function baseState(p: ProjectDoc): CoreState {
  return {
    project: p, projectPath: null, projectDirty: false,
    selection: { entityId: 1, sceneId: 's' },
    view: 'scene', bottomTab: 'assets',
    openScripts: [], activeScriptPath: null, isPlaying: false,
  }
}

describe('coreReducer — ECS components', () => {
  it('ENTITY_SET_COMPONENT adds and updates, marks dirty', () => {
    let s = coreReducer(baseState(project()), {
      type: 'ENTITY_SET_COMPONENT', entityId: 1, key: 'health',
      value: { maxHp: 100, currentHp: 100, iFrames: 0.2 },
    })
    expect(s.project!.entities[1].health).toEqual({ maxHp: 100, currentHp: 100, iFrames: 0.2 })
    expect(s.projectDirty).toBe(true)

    s = coreReducer(s, {
      type: 'ENTITY_SET_COMPONENT', entityId: 1, key: 'health',
      value: { maxHp: 100, currentHp: 50, iFrames: 0.2 },
    })
    expect(s.project!.entities[1].health!.currentHp).toBe(50)
  })

  it('ENTITY_REMOVE_COMPONENT deletes the key immutably', () => {
    const prev = coreReducer(baseState(project()), {
      type: 'ENTITY_SET_COMPONENT', entityId: 1, key: 'sensor',
      value: { shape: 'Circle', radius: 120, width: 64, height: 64, targetTag: 'player' },
    })
    const next = coreReducer(prev, {
      type: 'ENTITY_REMOVE_COMPONENT', entityId: 1, key: 'sensor',
    })
    expect(next.project!.entities[1].sensor).toBeUndefined()
    expect(prev.project!.entities[1].sensor).toBeDefined() // immutability
    expect(next).not.toBe(prev)
  })

  it('no-op when entity missing / no project', () => {
    const s = coreReducer(baseState(project()), {
      type: 'ENTITY_SET_COMPONENT', entityId: 99, key: 'health', value: { maxHp: 1, currentHp: 1, iFrames: 0 },
    })
    expect(s.projectDirty).toBe(false)
  })
})

describe('project.json roundtrip with components', () => {
  it('serialize → parse preserves components, omits when absent', () => {
    const withComp = coreReducer(baseState(project()), {
      type: 'ENTITY_SET_COMPONENT', entityId: 1, key: 'platformerController',
      value: { maxSpeed: 300, jumpForce: 600, customGravity: 1500, coyoteTime: 0.15, jumpBuffer: 0.1 },
    }).project!

    const json = serializeProjectDoc(withComp)
    expect(json).toContain('platformerController')
    const again = parseProjectDoc(json)!
    expect(again.entities[1].platformerController).toEqual(
      withComp.entities[1].platformerController,
    )

    // entity without components → no component keys leak into JSON
    const plain = serializeProjectDoc(project())
    expect(plain).not.toContain('platformerController')
    expect(plain).not.toContain('"sensor"')
  })

  it('parse drops a component that is not an object (defensive)', () => {
    const raw = JSON.stringify({
      projectName: 'D', version: '2.0.0', gameResolution: [1280, 720],
      targetFPS: 60, activeSceneId: 's', mainScriptPath: 'scripts/main.lua',
      entities: { 1: { id: 1, name: 'E', className: 'C', tags: [], health: 'bogus', sensor: { shape: 'Circle', radius: 10, width: 1, height: 1, targetTag: 't' } } },
      scenes: { s: { id: 's', name: 'S', entityIds: [1] } },
    })
    const p = parseProjectDoc(raw)!
    expect(p.entities[1].health).toBeUndefined()        // string → dropped
    expect(p.entities[1].sensor).toBeDefined()          // object → kept
  })
})
