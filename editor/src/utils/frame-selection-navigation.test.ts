import { describe, expect, it, vi, beforeEach } from 'vitest'
import { computeFrameSelectionView } from './frame-selection'
import { editorCenterWorldPoint } from './editor-viewport-intents'
import { editorSetEditorView } from './wasm-bridge'

vi.mock('./wasm-bridge', () => ({
  editorSetEditorView: vi.fn(),
  editorReadEditorView: vi.fn(() => ({ x: 0, y: 0, zoomDevice: 1 })),
  editorFrameWorldBounds: vi.fn(),
}))

describe('frame selected navigation', () => {
  beforeEach(() => {
    vi.mocked(editorSetEditorView).mockReset()
  })

  it('centers the viewport when Frame Selected runs explicitly', () => {
    const entity = {
      position: { x: 320, y: 180 },
      scale: { x: 1, y: 1 },
    }
    const clientW = 800
    const clientH = 600
    const paddingPx = 32

    const { zoom: nextZoom, center } = computeFrameSelectionView({
      position: entity.position,
      scale: entity.scale,
      clientW,
      clientH,
      paddingPx,
    })

    editorCenterWorldPoint(center, clientW, clientH, nextZoom, 1)

    expect(editorSetEditorView).toHaveBeenCalledOnce()
    const [cameraX, cameraY, zoomDevice] = vi.mocked(editorSetEditorView).mock.calls[0]!
    expect(cameraX).toBeCloseTo(center.x - clientW / (2 * nextZoom))
    expect(cameraY).toBeCloseTo(center.y - clientH / (2 * nextZoom))
    expect(zoomDevice).toBeCloseTo(nextZoom)
  })
})
