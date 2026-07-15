import type { Vec4 } from '../types'

/** Logical or physical pixel dimensions for runtime canvas layout. */
export type DisplaySize = Readonly<{ x: number; y: number }>

export const RUNTIME_PLAY_STAGE_PADDING_PX = 16

/**
 * Available area inside a play stage after symmetric padding.
 */
export function playStageAvailableSize(
  stageSize: DisplaySize,
  paddingPx = RUNTIME_PLAY_STAGE_PADDING_PX,
): DisplaySize {
  return {
    x: Math.max(1, stageSize.x - paddingPx * 2),
    y: Math.max(1, stageSize.y - paddingPx * 2),
  }
}

/**
 * Formats a scene background colour for canvas CSS.
 * @param color linear RGBA 0–1; alpha is ignored for the CSS background
 */
export function sceneBackgroundCss(
  color: Vec4 | null | undefined,
  fallback = '#050608',
): string {
  if (!color) return fallback
  return `rgb(${Math.round(color.x * 255)}, ${Math.round(color.y * 255)}, ${Math.round(color.z * 255)})`
}

/**
 * Visual-only canvas presentation. Geometry (fixed left/top/width/height) is
 * owned by {@link syncRuntimeSurfaceLayout} — never set position here or the
 * pin-on-body binder will fight React/CSS absolute layout.
 */
export type RuntimeCanvasVisualStyle = Readonly<{
  background: string
  imageRendering?: 'auto' | 'pixelated'
  pointerEvents?: 'auto' | 'none'
  visibility?: 'visible' | 'hidden'
  opacity?: string
}>

/**
 * Play-mode visual presentation (docked or external preview host).
 */
export function runtimeCanvasPlayVisual(params: Readonly<{
  background: string
  pointerEvents?: 'auto' | 'none'
  visibility?: 'visible' | 'hidden'
}>): RuntimeCanvasVisualStyle {
  return {
    background: params.background,
    imageRendering: 'pixelated',
    pointerEvents: params.pointerEvents,
    visibility: params.visibility ?? 'visible',
    opacity: '1',
  }
}

/**
 * Boot / waiting canvas before a scene viewport is known (floating preview only).
 */
export function runtimeCanvasBootVisual(background: string): RuntimeCanvasVisualStyle {
  return {
    background,
    imageRendering: 'pixelated',
    visibility: 'visible',
    opacity: '1',
  }
}

/**
 * Edit-mode visual presentation. Framebuffer size is driven by editorResizeSurface.
 */
export function runtimeCanvasEditVisual(params: Readonly<{
  background: string
  pointerEvents?: 'auto' | 'none'
}>): RuntimeCanvasVisualStyle {
  return {
    background: params.background,
    imageRendering: 'auto',
    pointerEvents: params.pointerEvents,
    visibility: 'visible',
    opacity: '1',
  }
}

/** @deprecated Prefer runtimeCanvasPlayVisual — geometry is binder-owned. */
export type RuntimeCanvasPlayLayout = 'docked-top-left' | 'floating-centered'

/**
 * @deprecated Prefer runtimeCanvasPlayVisual. Kept for callers that still
 * expect width/height keys in tests; binder overwrites geometry after apply.
 */
export function runtimeCanvasPlayStyle(params: Readonly<{
  hostSize: DisplaySize
  background: string
  layout: RuntimeCanvasPlayLayout
  pointerEvents?: 'auto' | 'none'
}>): Partial<CSSStyleDeclaration> {
  const visual = runtimeCanvasPlayVisual(params)
  const w = Math.max(1, Math.round(params.hostSize.x))
  const h = Math.max(1, Math.round(params.hostSize.y))
  if (params.layout === 'floating-centered') {
    return {
      display: 'block',
      ...visual,
      // Width/height retained for test contract; binder replaces left/top.
      width: `${w}px`,
      height: `${h}px`,
      transform: 'translate(-50%, -50%)',
    } as Partial<CSSStyleDeclaration>
  }
  return {
    display: 'block',
    ...visual,
    width: `${w}px`,
    height: `${h}px`,
    transform: 'none',
  } as Partial<CSSStyleDeclaration>
}

/** @deprecated Prefer runtimeCanvasBootVisual. */
export function runtimeCanvasBootStyle(
  windowSize: DisplaySize,
  background: string,
): Partial<CSSStyleDeclaration> {
  const w = Math.max(1, Math.round(windowSize.x))
  const h = Math.max(1, Math.round(windowSize.y))
  return {
    display: 'block',
    ...runtimeCanvasBootVisual(background),
    width: `${w}px`,
    height: `${h}px`,
    transform: 'translate(-50%, -50%)',
  } as Partial<CSSStyleDeclaration>
}

/** @deprecated Prefer runtimeCanvasEditVisual. */
export function runtimeCanvasEditStyle(params: Readonly<{
  cssWidth: number
  cssHeight: number
  background: string
  pointerEvents?: 'auto' | 'none'
}>): Partial<CSSStyleDeclaration> {
  return {
    display: 'block',
    ...runtimeCanvasEditVisual(params),
    width: `${Math.max(1, params.cssWidth)}px`,
    height: `${Math.max(1, params.cssHeight)}px`,
    transform: 'none',
  } as Partial<CSSStyleDeclaration>
}

/**
 * Applies visual CSS only. Does not set position/left/top — the SurfaceBinder owns geometry.
 */
export function applyRuntimeCanvasPresentation(
  canvas: HTMLCanvasElement,
  style: Partial<CSSStyleDeclaration> | RuntimeCanvasVisualStyle,
): void {
  const next = style as Partial<CSSStyleDeclaration> & RuntimeCanvasVisualStyle
  if (next.background != null) canvas.style.background = next.background
  if (next.imageRendering != null) canvas.style.imageRendering = next.imageRendering
  if (next.pointerEvents != null) canvas.style.pointerEvents = next.pointerEvents
  if (next.visibility != null) canvas.style.visibility = next.visibility
  if (next.opacity != null) canvas.style.opacity = next.opacity
  if (next.display != null) canvas.style.display = next.display
}
