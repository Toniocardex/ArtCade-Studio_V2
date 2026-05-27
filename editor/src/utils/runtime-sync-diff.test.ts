import { describe, it, expect } from 'vitest'
import { planProjectSync } from './runtime-sync-diff'
import { runtimeProjectProjection } from './runtime-fingerprint'

function makeProject() {
  return {
    projectName: 'T',
    version: '1',
    activeSceneId: 'a',
    mainScriptPath: 'm.lua',
    targetFPS: 60,
    entities: {
      1: {
        id: 1,
        name: 'P',
        className: 'Player',
        tags: [],
        transform: {
          position: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotation: 0,
        },
        sprite: {
          spriteAssetId: '',
          tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 },
          alpha: 1,
          pivot: { x: 0.5, y: 0.5 },
          renderOrder: 0,
        },
      },
    },
    scenes: {
      a: {
        id: 'a',
        name: 'A',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [1],
      },
    },
  }
}

describe('planProjectSync', () => {
  it('requires full load on first sync', () => {
    const p = makeProject()
    expect(planProjectSync(null, p as never, 'a')).toEqual({ kind: 'full' })
  })

  it('plans incremental entity update for tint change', () => {
    const p = makeProject()
    const prev = runtimeProjectProjection(p as never, 'a')
    p.entities[1].sprite.fillColor = { x: 0, y: 1, z: 0 }
    expect(planProjectSync(prev, p as never, 'a')).toEqual({
      kind: 'incremental',
      entityIds: [1],
      sceneIds: [],
    })
  })

  it('plans scene settings patch without entity reload', () => {
    const p = makeProject()
    const prev = runtimeProjectProjection(p as never, 'a')
    p.scenes.a.backgroundColor = { x: 1, y: 0, z: 0, w: 1 }
    expect(planProjectSync(prev, p as never, 'a')).toEqual({
      kind: 'incremental',
      entityIds: [],
      sceneIds: ['a'],
    })
  })

  it('requires full load when entity ids change', () => {
    const p = makeProject()
    const prev = runtimeProjectProjection(p as never, 'a')
    ;(p.entities as Record<number, (typeof p.entities)[1]>)[2] = {
      ...p.entities[1],
      id: 2,
      name: 'B',
    }
    p.scenes.a.entityIds = [1, 2]
    expect(planProjectSync(prev, p as never, 'a')).toEqual({ kind: 'full' })
  })
})
