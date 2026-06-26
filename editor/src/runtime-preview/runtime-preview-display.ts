import type { PreviewTransitionBundle } from '../utils/runtime-sync-service'
import type { PresentationSnapshot } from '../utils/presentation-snapshot'
import {
  type DisplaySize,
  runtimeCanvasBootStyle,
  runtimeCanvasPlayStyle,
  sceneBackgroundCss,
} from '../utils/runtime-canvas-presentation'

export type RuntimePreviewDisplaySize = DisplaySize

function isRuntimePreviewSnapshot(presentation: PresentationSnapshot | null | undefined): presentation is PresentationSnapshot {
  return presentation != null
    && presentation.revision > 0n
    && (presentation.effectiveMode === 'playExternal' || presentation.effectiveMode === 'playFullscreen')
}

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
  _presentation?: PresentationSnapshot | null,
): RuntimePreviewDisplaySize {
  if (!logical) {
    return {
      x: Math.max(1, Math.round(windowSize.x)),
      y: Math.max(1, Math.round(windowSize.y)),
    }
  }
  return {
    x: Math.max(1, Math.round(windowSize.x)),
    y: Math.max(1, Math.round(windowSize.y)),
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
  if (!isRuntimePreviewSnapshot(presentation)) {
    return {
      ...runtimeCanvasBootStyle(windowSize, background),
      visibility: 'hidden',
    }
  }
  const hostSize = runtimePreviewDisplaySize(logical, windowSize, presentation)
  return runtimeCanvasPlayStyle({
    hostSize,
    background,
    layout: 'floating-centered',
  })
}
