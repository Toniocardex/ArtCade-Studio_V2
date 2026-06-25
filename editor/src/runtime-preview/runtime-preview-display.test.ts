// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../utils/project-factory'
import type { PreviewTransitionBundle } from '../utils/runtime-sync-service'
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

describe('runtime-preview-display', () => {
  it('resolves the scene viewport as the logical runtime size', () => {
    const bundle = makeBundle()

    expect(runtimePreviewLogicalSize(bundle)).toEqual({ x: 512, y: 320 })
  })

  it('uses integer fit scaling without stretching the logical viewport', () => {
    expect(runtimePreviewDisplaySize(
      { x: 512, y: 320 },
      { x: 1024, y: 768 },
    )).toEqual({ x: 1024, y: 640 })
  })

  it('falls back to the full window before a preview bundle arrives', () => {
    expect(runtimePreviewDisplaySize(null, { x: 900.4, y: 500.6 }))
      .toEqual({ x: 900, y: 501 })
  })

  it('returns a centered pixelated canvas style scaled from the logical viewport', () => {
    const style = runtimePreviewCanvasStyle(makeBundle(), { x: 1024, y: 768 })

    expect(style.width).toBe('512px')
    expect(style.height).toBe('320px')
    expect(style.left).toBe('50%')
    expect(style.top).toBe('50%')
    expect(style.transform).toBe('translate(-50%, -50%) scale(2)')
    expect(style.imageRendering).toBe('pixelated')
  })

  it('uses the active scene background color', () => {
    expect(runtimePreviewBackground(makeBundle())).toBe('rgb(21, 23, 28)')
  })
})
