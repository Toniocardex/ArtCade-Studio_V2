import { describe, expect, it, vi } from 'vitest'
import { editorFrameSelectionEntity } from './editor-viewport-intents'
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

vi.mock('./wasm-bridge', () => ({
  editorFrameSelection: vi.fn(),
  editorFrameWorldBounds: vi.fn(),
  editorSetEditorView: vi.fn(),
}))

vi.mock('./runtime-sync-service', () => ({
  runtimeSync: {
    syncPresentationSnapshotNow: vi.fn(),
  },
}))

vi.mock('./presentation-store', () => ({
  getPresentationSnapshot: vi.fn(() => SAMPLE),
}))

const bridge = await import('./wasm-bridge')

describe('frame selection navigation', () => {
  it('delegates entity framing to WASM and syncs zoom from the presentation snapshot', () => {
    const dispatch = vi.fn()
    editorFrameSelectionEntity(
      { x: 240, y: 130 },
      { x: 4, y: 1 },
      dispatch,
      2,
    )
    expect(bridge.editorFrameSelection).toHaveBeenCalledWith(240, 130, 4, 1)
    expect(bridge.editorSetEditorView).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith({ type: 'EDITOR_SET_ZOOM', zoom: 2 })
  })
})
