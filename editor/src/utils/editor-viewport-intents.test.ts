import { describe, expect, it, vi } from 'vitest'
import { syncEditorZoomFromWasm } from './editor-viewport-intents'
import type { PresentationSnapshot } from './presentation-snapshot'

const SAMPLE: PresentationSnapshot = {
  revision: 2n,
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
  editorViewOrigin: { x: 0, y: 0 },
  surfacePixelsPerWorldUnit: 2,
  visibleWorldBounds: { minX: 0, minY: 0, maxX: 400, maxY: 300 },
}

vi.mock('./runtime-sync-service', () => ({
  runtimeSync: {
    syncPresentationSnapshotNow: vi.fn(),
  },
}))

vi.mock('./presentation-store', () => ({
  getPresentationSnapshot: vi.fn(() => SAMPLE),
}))

describe('syncEditorZoomFromWasm', () => {
  it('reads zoom from the presentation snapshot store', () => {
    const dispatch = vi.fn()
    syncEditorZoomFromWasm(dispatch, 2)
    expect(dispatch).toHaveBeenCalledWith({ type: 'EDITOR_SET_ZOOM', zoom: 2 })
  })
})
