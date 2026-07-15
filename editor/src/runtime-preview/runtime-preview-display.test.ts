// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../utils/project-factory'
import type { PreviewTransitionBundle } from '../utils/runtime-sync-service'
import type { PresentationSnapshot } from '../utils/presentation-snapshot'
import {
  runtimePreviewBackground,
  runtimePreviewCanvasStyle,
  runtimePreviewDisplaySize,
  runtimePreviewLogicalSize,
} from './runtime-preview-display'

function makeBundle(): PreviewTransitionBundle {
  const project = createBlankProject('Display Test')
  return {
    project,
    activeSceneId: project.activeSceneId,
    mainLua: 'function tick(dt) end',
    dialogs: {},
    projectPath: '',
  }
}

const SNAPSHOT: PresentationSnapshot = {
  revision: 1n,
  effectiveMode: 'playExternal',
  letterboxActive: false,
  useIdentityPlacement: false,
  surfaceFramebuffer: { width: 1024, height: 768 },
  logical: { width: 512, height: 320 },
  placement: {
    destX: 0,
    destY: 64,
    destW: 1024,
    destH: 640,
    scaleX: 2,
    scaleY: 2,
  },
  presentationScale: 2,
  editorViewOrigin: { x: 0, y: 0 },
  surfacePixelsPerWorldUnit: 2,
  visibleWorldBounds: { minX: 0, minY: 0, maxX: 512, maxY: 320 },
}

describe('runtime-preview-display', () => {
  it('resolves the scene viewport as the logical runtime size', () => {
    const bundle = makeBundle()

    expect(runtimePreviewLogicalSize(bundle)).toEqual({ x: 512, y: 320 })
  })

  it('uses the full host surface until a committed snapshot exists', () => {
    expect(runtimePreviewDisplaySize(
      { x: 512, y: 320 },
      { x: 1024, y: 768 },
    )).toEqual({ x: 1024, y: 768 })
  })

  it('uses the full host surface after presentation commit', () => {
    expect(runtimePreviewDisplaySize(
      { x: 512, y: 320 },
      { x: 1024, y: 768 },
      SNAPSHOT,
    )).toEqual({ x: 1024, y: 768 })
  })

  it('falls back to the full window before a preview bundle arrives', () => {
    expect(runtimePreviewDisplaySize(null, { x: 900.4, y: 500.6 }))
      .toEqual({ x: 900, y: 501 })
  })

  it('returns visual-only style; geometry is SurfaceBinder-owned', () => {
    const style = runtimePreviewCanvasStyle(makeBundle(), { x: 1024, y: 768 }, SNAPSHOT)

    expect(style.imageRendering).toBe('pixelated')
    expect(style.visibility).toBe('visible')
    expect(style).not.toHaveProperty('width')
    expect(style).not.toHaveProperty('left')
    expect(style).not.toHaveProperty('transform')
  })

  it('hides the compositor canvas before the first committed snapshot', () => {
    const style = runtimePreviewCanvasStyle(makeBundle(), { x: 1024, y: 768 })

    expect(style.visibility).toBe('hidden')
  })

  it('uses the active scene background color', () => {
    expect(runtimePreviewBackground(makeBundle())).toBe('rgb(21, 23, 28)')
  })
})
