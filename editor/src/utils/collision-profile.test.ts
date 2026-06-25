import { describe, expect, it } from 'vitest'
import {
  pixelRectToShape,
  pixelRectToShapePatch,
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
    const shape = { type: 'rectangle' as const, offsetX: 0.1, offsetY: 0.2, width: 0.5, height: 0.6 }
    const px = shapeToPixelRect(shape, frame, 1)
    const back = pixelRectToShape(px, frame, 1)
    expect(back.offsetX).toBeCloseTo(0.1, 2)
    expect(back.offsetY).toBeCloseTo(0.2, 2)
    expect(back.width).toBeCloseTo(0.5, 2)
    expect(back.height).toBeCloseTo(0.6, 2)
  })

  it('uses polygon point bounds for overlay rectangles', () => {
    const frame = { x: 32, y: 16, w: 100, h: 50 }
    const shape = {
      type: 'polygon' as const,
      offsetX: 0.1,
      offsetY: 0.2,
      width: 0.8,
      height: 0.7,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.6, y: 0.2 },
        { x: 0.2, y: 0.7 },
      ],
    }
    const px = shapeToPixelRect(shape, frame, 2)
    expect(px.x).toBeCloseTo(104)
    expect(px.y).toBeCloseTo(72)
    expect(px.w).toBeCloseTo(100)
    expect(px.h).toBeCloseTo(50)
  })

  it('scales polygon points when resizing from the overlay', () => {
    const frame = { x: 0, y: 0, w: 100, h: 100 }
    const shape = {
      type: 'polygon' as const,
      offsetX: 0.1,
      offsetY: 0.1,
      width: 0.4,
      height: 0.4,
      points: [
        { x: 0, y: 0 },
        { x: 0.4, y: 0 },
        { x: 0, y: 0.4 },
      ],
    }
    const patch = pixelRectToShapePatch(shape, { x: 10, y: 10, w: 80, h: 80 }, frame, 1)
    expect(patch.offsetX).toBeCloseTo(0.1)
    expect(patch.offsetY).toBeCloseTo(0.1)
    expect(patch.width).toBeCloseTo(0.8)
    expect(patch.height).toBeCloseTo(0.8)
    expect(patch.points?.[1]?.x).toBeCloseTo(0.8)
    expect(patch.points?.[2]?.y).toBeCloseTo(0.8)
  })

  it('keeps circle overlay geometry square on non-square frames', () => {
    const frame = { x: 0, y: 0, w: 100, h: 50 }
    const shape = { type: 'circle' as const, offsetX: 0.1, offsetY: 0.2, width: 0.4, height: 0.9 }
    const px = shapeToPixelRect(shape, frame, 1)
    expect(px.w).toBeCloseTo(40)
    expect(px.h).toBeCloseTo(40)
    const patch = pixelRectToShapePatch(shape, { x: 10, y: 10, w: 30, h: 80 }, frame, 1)
    expect(patch.width).toBeCloseTo(0.3)
    expect(patch.height).toBeCloseTo(0.6)
    expect(patch.radius).toBeCloseTo(15)
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
