import { describe, it, expect } from 'vitest'
import { clampCameraStart } from './camera-start'

const WORLD = { x: 1280, y: 640 }
const VP = { x: 512, y: 320 }

describe('clampCameraStart', () => {
  it('keeps an in-bounds position untouched', () => {
    expect(clampCameraStart(WORLD, VP, { x: 100, y: 80 })).toEqual({ x: 100, y: 80 })
  })

  it('clamps the top-left so the viewport stays inside the world', () => {
    expect(clampCameraStart(WORLD, VP, { x: 9999, y: 9999 })).toEqual({ x: 768, y: 320 })
  })

  it('clamps negatives back to the origin', () => {
    expect(clampCameraStart(WORLD, VP, { x: -50, y: -50 })).toEqual({ x: 0, y: 0 })
  })

  it('pins to 0 on an axis where the world is not larger than the viewport', () => {
    expect(clampCameraStart({ x: 512, y: 900 }, VP, { x: 200, y: 200 })).toEqual({ x: 0, y: 200 })
  })
})
