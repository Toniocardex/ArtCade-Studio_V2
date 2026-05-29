import { describe, expect, it } from 'vitest'
import {
  resolveEffectivePivot,
  spriteAssignedFromAsset,
  usesAssetPivot,
} from './sprite-pivot-resolve'
import type { ImageAsset, SpriteComponent } from '../types'

const asset: ImageAsset = {
  id: 'img1',
  name: 'hero.png',
  path: 'assets/hero.png',
  defaultPivot: { x: 0.5, y: 1 },
}

describe('sprite-pivot-resolve', () => {
  it('inherits defaultPivot from asset when pivotFromAsset is true', () => {
    const sprite: SpriteComponent = {
      spriteAssetId: asset.path,
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivotFromAsset: true,
      pivot: { x: 0.5, y: 0.5 },
      renderOrder: 0,
    }
    expect(resolveEffectivePivot(sprite, { img1: asset })).toEqual({ x: 0.5, y: 1 })
    expect(usesAssetPivot(sprite)).toBe(true)
  })

  it('assign sprite resets to asset pivot', () => {
    const base: SpriteComponent = {
      spriteAssetId: '',
      tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1,
      pivotFromAsset: false,
      pivot: { x: 0, y: 0 },
      renderOrder: 0,
    }
    const next = spriteAssignedFromAsset(base, asset)
    expect(next.pivotFromAsset).toBe(true)
    expect(next.spriteAssetId).toBe(asset.path)
    expect(next.pivot).toEqual({ x: 0.5, y: 1 })
  })
})
