import type { PreviewTransitionBundle } from '../utils/runtime-sync-service'
import {
  type DisplaySize,
  playFitScale,
  runtimeCanvasBootStyle,
  runtimeCanvasPlayStyle,
  sceneBackgroundCss,
} from '../utils/runtime-canvas-presentation'

export type RuntimePreviewDisplaySize = DisplaySize

export function runtimePreviewLogicalSize(
  bundle: PreviewTransitionBundle | null,
): RuntimePreviewDisplaySize | null {
  const scene = bundle?.project.scenes[bundle.activeSceneId]
  const size = scene?.viewportSize ?? scene?.worldSize
  if (!size || size.x <= 0 || size.y <= 0) return null
  return size
}

export function runtimePreviewDisplaySize(
  logical: RuntimePreviewDisplaySize | null,
  windowSize: RuntimePreviewDisplaySize,
): RuntimePreviewDisplaySize {
  if (!logical) {
    return {
      x: Math.max(1, Math.round(windowSize.x)),
      y: Math.max(1, Math.round(windowSize.y)),
    }
  }
  const scale = playFitScale(logical, windowSize, { integerUpscale: true })
  return {
    x: Math.max(1, Math.round(logical.x * scale)),
    y: Math.max(1, Math.round(logical.y * scale)),
  }
}

export function runtimePreviewBackground(bundle: PreviewTransitionBundle | null): string {
  const scene = bundle?.project.scenes[bundle.activeSceneId]
  return sceneBackgroundCss(scene?.backgroundColor)
}

export function runtimePreviewCanvasStyle(
  bundle: PreviewTransitionBundle | null,
  windowSize: RuntimePreviewDisplaySize,
): Partial<CSSStyleDeclaration> {
  const logical = runtimePreviewLogicalSize(bundle)
  const background = runtimePreviewBackground(bundle)
  if (!logical) {
    return runtimeCanvasBootStyle(windowSize, background)
  }
  const scale = playFitScale(logical, windowSize, { integerUpscale: true })
  return runtimeCanvasPlayStyle({
    viewport: logical,
    scale,
    background,
    layout: 'floating-centered',
  })
}
