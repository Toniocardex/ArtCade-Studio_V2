import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EDITOR_CAMERA_VIEW,
  editorViewFromSnapshot,
  editorZoomCssFromSnapshot,
  visibleWorldCenterFromSnapshot,
} from './editor-camera-from-snapshot'
import type { PresentationSnapshot } from './presentation-snapshot'

const SAMPLE: PresentationSnapshot = {
  revision: 1n,
  effectiveMode: 'sceneEdit',
  letterboxActive: false,
  useIdentityPlacement: false,
  surfaceFramebuffer: { width: 800, height: 600 },
  logical: { width: 800, height: 600 },
  placement: {
    destX: 0,
    destY: 0,
    destW: 800,
    destH: 600,
    scaleX: 1,
    scaleY: 1,
  },
  presentationScale: 1,
  editorViewOrigin: { x: 120, y: 80 },
  surfacePixelsPerWorldUnit: 2,
  visibleWorldBounds: { minX: 0, minY: 0, maxX: 400, maxY: 300 },
}

describe('editor-camera-from-snapshot', () => {
  it('maps snapshot fields to editor view state', () => {
    expect(editorViewFromSnapshot(SAMPLE, 2)).toEqual({
      x: 120,
      y: 80,
      zoomDevice: 4,
    })
  })

  it('derives CSS zoom from surfacePixelsPerWorldUnit', () => {
    expect(editorZoomCssFromSnapshot(SAMPLE, 2)).toBe(2)
  })

  it('falls back to defaults when zoom is non-positive', () => {
    const snap = {
      ...SAMPLE,
      surfacePixelsPerWorldUnit: 0,
    }
    expect(editorViewFromSnapshot(snap, 1)).toEqual({
      x: 120,
      y: 80,
      zoomDevice: 1,
    })
  })

  it('exports stable default view', () => {
    expect(DEFAULT_EDITOR_CAMERA_VIEW).toEqual({ x: 0, y: 0, zoomDevice: 1 })
  })

  it('derives visible world centre from snapshot bounds', () => {
    expect(visibleWorldCenterFromSnapshot(SAMPLE)).toEqual({ x: 200, y: 150 })
  })
})
