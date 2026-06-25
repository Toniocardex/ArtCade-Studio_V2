import type { PreviewTransitionBundle } from '../utils/runtime-sync-service'

export type RuntimePreviewDisplaySize = Readonly<{ x: number; y: number }>

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
  if (!logical) return {
    x: Math.max(1, Math.round(windowSize.x)),
    y: Math.max(1, Math.round(windowSize.y)),
  }
  const scaleX = windowSize.x / logical.x
  const scaleY = windowSize.y / logical.y
  let scale = Math.max(0.01, Math.min(scaleX, scaleY))
  if (scale >= 1) scale = Math.max(1, Math.floor(scale))
  return {
    x: Math.max(1, Math.round(logical.x * scale)),
    y: Math.max(1, Math.round(logical.y * scale)),
  }
}

export function runtimePreviewBackground(bundle: PreviewTransitionBundle | null): string {
  const scene = bundle?.project.scenes[bundle.activeSceneId]
  const color = scene?.backgroundColor
  if (!color) return '#050608'
  return `rgb(${Math.round(color.x * 255)}, ${Math.round(color.y * 255)}, ${Math.round(color.z * 255)})`
}

export function runtimePreviewCanvasStyle(
  bundle: PreviewTransitionBundle | null,
  windowSize: RuntimePreviewDisplaySize,
): Partial<CSSStyleDeclaration> {
  const displaySize = runtimePreviewDisplaySize(
    runtimePreviewLogicalSize(bundle),
    windowSize,
  )
  return {
    display: 'block',
    position: 'absolute',
    inset: 'auto',
    left: '50%',
    top: '50%',
    right: 'auto',
    bottom: 'auto',
    width: `${displaySize.x}px`,
    height: `${displaySize.y}px`,
    transform: 'translate(-50%, -50%)',
    transformOrigin: 'center center',
    objectFit: 'fill',
    background: runtimePreviewBackground(bundle),
    imageRendering: 'pixelated',
  }
}
