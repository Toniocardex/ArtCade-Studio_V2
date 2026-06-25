import { describe, expect, it } from 'vitest'
import {
  pixelRectToShape,
  referenceFrameRect,
  shapeToPixelRect,
} from '../panels/spritesheet-studio/collision/collision-shape-math'
import {
  createDefaultCollisionProfile,
  getCollisionProfile,
  getOrCreateCollisionProfile,
  patchCollisionProfile,
  resolvedCollisionShapes,
} from './collision-profile'
import { parseProjectDoc, serializeProjectDoc } from './project-codec'
import type { EntityDef } from '../types'
import { createBlankProject } from './project-factory'

describe('collision-shape-math', () => {
  it('converts normalized shape to pixel rect and back', () => {
    const frame = { x: 32, y: 16, w: 64, h: 48 }
    const shape = { offsetX: 0.1, offsetY: 0.2, width: 0.5, height: 0.6 }
    const px = shapeToPixelRect(shape, frame, 1)
    const back = pixelRectToShape(px, frame, 1)
    expect(back.offsetX).toBeCloseTo(0.1, 2)
    expect(back.offsetY).toBeCloseTo(0.2, 2)
    expect(back.width).toBeCloseTo(0.5, 2)
    expect(back.height).toBeCloseTo(0.6, 2)
  })

  it('falls back to full sheet when frame is missing', () => {
    expect(referenceFrameRect(null, 128, 64)).toEqual({ x: 0, y: 0, w: 128, h: 64 })
  })
})

describe('collision-profile utils', () => {
  it('stores and resolves profile shapes for linked sprite', () => {
    const project = createBlankProject('Test')
    project.assets = {
      img_a: {
        id: 'img_a',
        name: 'Hero',
        path: 'assets/hero.png',
        usage: 'sprite',
      },
    }
    project.collisionProfiles = {
      img_a: createDefaultCollisionProfile('img_a', 'Hero', 'player'),
    }
    const entity: EntityDef = {
      id: 1,
      name: 'Player',
      className: 'Player',
      tags: [],
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, velocity: { x: 0, y: 0 } },
      sprite: { spriteAssetId: 'assets/hero.png', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      collisionBody: { bodyType: 'kinematic', enabled: true, shapes: [] },
    }
    expect(getCollisionProfile(project, 'img_a')?.shapes).toHaveLength(1)
    expect(resolvedCollisionShapes(entity, project)).toHaveLength(1)
    expect(resolvedCollisionShapes(entity, project)[0]?.layerId).toBe('player')
  })

  it('patchCollisionProfile merges into project', () => {
    const base = createBlankProject('Test')
    const next = patchCollisionProfile(
      base,
      'img_a',
      getOrCreateCollisionProfile(base, 'img_a', 'Hero'),
    )
    expect(next.collisionProfiles?.img_a?.id).toBe('img_a')
  })
})

describe('collision profile codec round-trip', () => {
  it('preserves collisionProfiles and physics.layers on save/load', () => {
    const project = createBlankProject('Codec')
    project.assets = {
      img_a: { id: 'img_a', name: 'Hero', path: 'assets/hero.png', usage: 'sprite' },
    }
    project.collisionProfiles = {
      img_a: createDefaultCollisionProfile('img_a', 'Hero', 'player'),
    }
    const parsed = parseProjectDoc(serializeProjectDoc(project))!
    expect(parsed.collisionProfiles?.img_a?.coordinateSpace).toBe('frame-normalized')
    expect(parsed.physics?.layers?.length).toBeGreaterThan(0)
  })
})
