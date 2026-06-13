import { describe, it, expect } from 'vitest'
import type { ProjectDoc } from '../types'
import { collectProjectDiagnostics, projectDiagnosticsErrors } from './project-validator'

function baseProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '1',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1,
        name: 'Hero',
        className: 'Hero',
        tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: 'missing', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 0, y: 0, z: 0 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
        visible: true,
        physics: {
          bodyType: 'Dynamic',
          collider: { shape: 'Rectangle', size: { x: 32, y: 32 }, offset: { x: 0, y: 0 }, density: 1, friction: 0.2, isSensor: false },
        },
      },
    },
    scenes: {
      s: {
        id: 's',
        name: 'S',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds: [1, 99],
      },
    },
    assets: {},
  }
}

describe('collectProjectDiagnostics', () => {
  it('flags missing sprite asset on entity', () => {
    const errors = projectDiagnosticsErrors(collectProjectDiagnostics(baseProject()))
    expect(errors.some((e) => e.message.includes('missing image asset "missing"'))).toBe(true)
  })

  it('flags scene entity id not in entities', () => {
    const errors = projectDiagnosticsErrors(collectProjectDiagnostics(baseProject()))
    expect(errors.some((e) => e.message.includes('missing entity id 99'))).toBe(true)
  })

  it('passes when asset and scene refs are valid', () => {
    const p = baseProject()
    p.assets = { hero: { id: 'hero', name: 'hero', path: 'sprites/hero.png' } }
    p.entities[1]!.sprite.spriteAssetId = 'hero'
    p.scenes.s!.entityIds = [1]
    delete p.entities[1]!.physics
    expect(projectDiagnosticsErrors(collectProjectDiagnostics(p))).toHaveLength(0)
  })

  it('accepts the image path stored by the sprite Inspector', () => {
    const p = baseProject()
    const spritePath = 'assets/images/walking.png'
    p.assets = {
      img_walking: {
        id: 'img_walking',
        name: 'walking.png',
        path: spritePath,
      },
    }
    p.entities[1]!.sprite.spriteAssetId = spritePath
    p.objectTypes = {
      Hero: {
        id: 'Hero',
        displayName: 'Hero',
        tags: [],
        sprite: { ...p.entities[1]!.sprite },
      },
    }
    p.scenes.s!.entityIds = [1]
    p.scenes.s!.instances = [{
      id: 1,
      objectTypeId: 'Hero',
      instanceName: 'Hero',
      transform: { ...p.entities[1]!.transform },
    }]
    delete p.entities[1]!.physics

    expect(projectDiagnosticsErrors(collectProjectDiagnostics(p))).toHaveLength(0)
  })

  it('flags invalid activeSceneId', () => {
    const p = baseProject()
    p.activeSceneId = 'missing'
    const errors = projectDiagnosticsErrors(collectProjectDiagnostics(p))
    expect(errors.some((e) => e.message.includes('activeSceneId'))).toBe(true)
  })

  it('flags duplicate logic board ids', () => {
    const p = baseProject()
    p.logicBoards = [
      {
        boardId: 'dup',
        target: { type: 'global' },
        events: [],
      },
      {
        boardId: 'dup',
        target: { type: 'global' },
        events: [],
      },
    ]
    const errors = projectDiagnosticsErrors(collectProjectDiagnostics(p))
    expect(errors.some((e) => e.message.includes('Duplicate Logic Board'))).toBe(true)
  })
})
