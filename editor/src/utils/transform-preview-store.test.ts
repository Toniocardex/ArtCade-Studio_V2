import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  clearTransformPreview,
  publishTransformPreview,
  queueTransformPreview,
} from './transform-preview-store'

describe('transform-preview-store', () => {
  beforeEach(() => {
    clearTransformPreview(1)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('queueTransformPreview coalesces to one rAF callback', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })

    queueTransformPreview({
      entityId: 1,
      x: 32,
      y: 64,
      rotation: 0,
      scaleX: 2,
      scaleY: 2,
    })
    queueTransformPreview({
      entityId: 1,
      x: 64,
      y: 64,
      rotation: 0,
      scaleX: 3,
      scaleY: 3,
    })

    expect(rafCallbacks).toHaveLength(1)
    expect(() => rafCallbacks[0]!(0)).not.toThrow()
  })

  it('publishTransformPreview accepts repeated identical snapshots', () => {
    const snapshot = {
      entityId: 1,
      x: 10,
      y: 20,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    }

    expect(() => {
      publishTransformPreview(snapshot)
      publishTransformPreview({ ...snapshot })
    }).not.toThrow()
  })

  it('clearTransformPreview is a no-op when preview is absent', () => {
    expect(() => clearTransformPreview(99)).not.toThrow()
  })
})
