import type { PreviewTransitionBundle } from '../utils/runtime-sync-service'
import type { PresentationSnapshot } from '../utils/presentation-snapshot'
import {
  type DisplaySize,
  playCssScaleFromSnapshot,
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
  presentation?: PresentationSnapshot | null,
): RuntimePreviewDisplaySize {
  if (!logical) {
    return {
      x: Math.max(1, Math.round(windowSize.x)),
      y: Math.max(1, Math.round(windowSize.y)),
    }
  }
  const scale = presentation && presentation.revision > 0n
    ? playCssScaleFromSnapshot(presentation, windowSize, { integerUpscale: true })
    : playFitScale(logical, windowSize, { integerUpscale: true })
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
  presentation?: PresentationSnapshot | null,
): Partial<CSSStyleDeclaration> {
  const logical = runtimePreviewLogicalSize(bundle)
  const background = runtimePreviewBackground(bundle)
  if (!logical) {
    return runtimeCanvasBootStyle(windowSize, background)
  }
  const hostSize = runtimePreviewDisplaySize(logical, windowSize, presentation)
  const scale = hostSize.x / Math.max(1, logical.x)
  return runtimeCanvasPlayStyle({
    viewport: logical,
    scale,
    hostSize,
    background,
    layout: 'floating-centered',
  })
}
