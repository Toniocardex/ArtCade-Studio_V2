import { describe, it, expect } from 'vitest'
import { runtimeProjectFingerprint } from './runtime-fingerprint'
import type { EntityDef, ProjectDoc, SceneDef, Vec4 } from '../types'

function vec(x: number, y: number) { return { x, y } }
function vec4(x: number, y: number, z: number, w: number): Vec4 { return { x, y, z, w } }

function makeEntity(overrides: Partial<EntityDef> = {}): EntityDef {
  return {
    id: 1,
    name: 'E1',
    className: 'Player',
    tags: [],
    transform: {
      position: vec(0, 0),
      scale:    vec(1, 1),
      rotation: 0,
    },
    sprite: {
      spriteAssetId: '',
      tint:          vec4(1, 1, 1, 1),
      alpha:         1,
      pivot:         vec(0.5, 0.5),
      renderOrder:   0,
    },
    ...overrides,
  }
}

function makeScene(overrides: Partial<SceneDef> = {}): SceneDef {
  return {
    id: 'scene_a',
    name: 'A',
    worldSize:       vec(1000, 600),
    viewportSize:    vec(800, 600),
    backgroundColor: vec4(0, 0, 0, 1),
    entityIds:       [1],
    ...overrides,
  }
}

function makeProject(overrides: Partial<ProjectDoc> = {}): ProjectDoc {
  return {
    projectName: 'Test',
    version: '1',
    activeSceneId: 'scene_a',
    mainScriptPath: 'main.lua',
    targetFPS: 60,
    entities: { 1: makeEntity() },
    scenes:   { scene_a: makeScene() },
    ...overrides,
  }
}

describe('runtimeProjectFingerprint', () => {
  it('is stable for equal projects regardless of object key order', () => {
    const a = makeProject({
      entities: { 2: makeEntity({ id: 2 }), 1: makeEntity({ id: 1 }) },
    })
    const b = makeProject({
      entities: { 1: makeEntity({ id: 1 }), 2: makeEntity({ id: 2 }) },
    })
    expect(runtimeProjectFingerprint(a, 'scene_a'))
      .toBe(runtimeProjectFingerprint(b, 'scene_a'))
  })

  it('changes when sprite tint changes (was silently ignored before)', () => {
    const base   = makeProject()
    const tinted = makeProject({
      entities: {
        1: makeEntity({
          sprite: {
            spriteAssetId: '', tint: vec4(1, 0, 0, 1),
            alpha: 1, pivot: vec(0.5, 0.5), renderOrder: 0,
          },
        }),
      },
    })
    expect(runtimeProjectFingerprint(base,   'scene_a'))
      .not.toBe(runtimeProjectFingerprint(tinted, 'scene_a'))
  })

  it('changes when className or tags change', () => {
    const base = makeProject()
    const renamed = makeProject({ entities: { 1: makeEntity({ className: 'Enemy' }) } })
    const tagged  = makeProject({ entities: { 1: makeEntity({ tags: ['boss'] }) } })
    expect(runtimeProjectFingerprint(base,    'scene_a'))
      .not.toBe(runtimeProjectFingerprint(renamed, 'scene_a'))
    expect(runtimeProjectFingerprint(base,   'scene_a'))
      .not.toBe(runtimeProjectFingerprint(tagged, 'scene_a'))
  })

  it('changes when an ECS component is attached', () => {
    const base = makeProject()
    const withHealth = makeProject({
      entities: { 1: makeEntity({ health: { maxHp: 10, currentHp: 10 } as never }) },
    })
    expect(runtimeProjectFingerprint(base,       'scene_a'))
      .not.toBe(runtimeProjectFingerprint(withHealth, 'scene_a'))
  })

  it('changes when active scene changes', () => {
    const proj = makeProject({
      scenes: { scene_a: makeScene({ id: 'scene_a' }), scene_b: makeScene({ id: 'scene_b' }) },
    })
    expect(runtimeProjectFingerprint(proj, 'scene_a'))
      .not.toBe(runtimeProjectFingerprint(proj, 'scene_b'))
  })

  it('changes on tilemap structure but not on tilemap.data', () => {
    const sceneWith = (cells: number[][]): SceneDef => makeScene({
      tilemap: { tileSize: 32, cols: 2, rows: 2, data: cells } as never,
    })
    const a = makeProject({ scenes: { scene_a: sceneWith([[0, 0], [0, 0]]) } })
    const b = makeProject({ scenes: { scene_a: sceneWith([[1, 2], [3, 4]]) } })
    expect(runtimeProjectFingerprint(a, 'scene_a'))
      .toBe(runtimeProjectFingerprint(b, 'scene_a'))

    const c = makeProject({
      scenes: { scene_a: makeScene({
        tilemap: { tileSize: 32, cols: 3, rows: 2, data: [[0, 0, 0], [0, 0, 0]] } as never,
      }) },
    })
    expect(runtimeProjectFingerprint(a, 'scene_a'))
      .not.toBe(runtimeProjectFingerprint(c, 'scene_a'))
  })
})
