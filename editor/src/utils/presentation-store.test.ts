import { describe, expect, it } from 'vitest'
import {
  clearPresentationSnapshot,
  getPresentationSnapshot,
  onPresentationChanged,
  publishPresentationSnapshot,
  resetPresentationStoreForTests,
} from './presentation-store'
import type { PresentationSnapshot } from './presentation-snapshot'

const SAMPLE: PresentationSnapshot = {
  revision: 1n,
  effectiveMode: 'playEmbedded',
  letterboxActive: false,
  useIdentityPlacement: false,
  surfaceFramebuffer: { width: 320, height: 240 },
  logical: { width: 320, height: 240 },
  placement: {
    destX: 0,
    destY: 0,
    destW: 320,
    destH: 240,
    scaleX: 1,
    scaleY: 1,
  },
  presentationScale: 1,
  editorViewOrigin: { x: 0, y: 0 },
  surfacePixelsPerWorldUnit: 1,
  visibleWorldBounds: { minX: 0, minY: 0, maxX: 320, maxY: 240 },
}

describe('presentation-store', () => {
  it('notifies listeners on revision change only', () => {
    resetPresentationStoreForTests()
    let count = 0
    const unsub = onPresentationChanged(() => { count++ })
    expect(publishPresentationSnapshot(SAMPLE)).toBe(true)
    expect(publishPresentationSnapshot(SAMPLE)).toBe(false)
    expect(count).toBe(1)
    expect(getPresentationSnapshot()?.revision).toBe(1n)
    unsub()
  })

  it('clearPresentationSnapshot drops committed state without removing listeners', () => {
    resetPresentationStoreForTests()
    publishPresentationSnapshot(SAMPLE)
    let count = 0
    const unsub = onPresentationChanged(() => { count++ })
    clearPresentationSnapshot()
    expect(getPresentationSnapshot()).toBeNull()
    publishPresentationSnapshot({ ...SAMPLE, revision: 2n })
    expect(count).toBe(1)
    unsub()
  })
})
