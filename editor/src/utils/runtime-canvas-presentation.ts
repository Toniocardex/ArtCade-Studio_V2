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

export type RuntimeCanvasPlayLayout = 'docked-top-left' | 'floating-centered'

/**
 * Imperative play-mode canvas presentation. The canvas fills the compositor
 * surface; output placement inside that surface belongs to C++ Presentation.
 */
export function runtimeCanvasPlayStyle(params: Readonly<{
  hostSize: DisplaySize
  background: string
  layout: RuntimeCanvasPlayLayout
  pointerEvents?: 'auto' | 'none'
}>): Partial<CSSStyleDeclaration> {
  const { hostSize, background, layout, pointerEvents } = params
  const pointer = pointerEvents ? { pointerEvents } : {}

  const w = Math.max(1, Math.round(hostSize.x))
  const h = Math.max(1, Math.round(hostSize.y))
  if (layout === 'floating-centered') {
    return {
      display: 'block',
      position: 'absolute',
      inset: 'auto',
      left: '50%',
      top: '50%',
      right: 'auto',
      bottom: 'auto',
      width: `${w}px`,
      height: `${h}px`,
      transform: 'translate(-50%, -50%)',
      transformOrigin: 'center center',
      background,
      imageRendering: 'pixelated',
      ...pointer,
    }
  }
  return {
    display: 'block',
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: `${w}px`,
    height: `${h}px`,
    transform: 'none',
    transformOrigin: '0 0',
    background,
    imageRendering: 'pixelated',
    ...pointer,
  }
}

/**
 * Boot / waiting canvas before a scene viewport is known (floating preview only).
 */
export function runtimeCanvasBootStyle(
  windowSize: DisplaySize,
  background: string,
): Partial<CSSStyleDeclaration> {
  const w = Math.max(1, Math.round(windowSize.x))
  const h = Math.max(1, Math.round(windowSize.y))
  return {
    display: 'block',
    position: 'absolute',
    inset: 'auto',
    left: '50%',
    top: '50%',
    right: 'auto',
    bottom: 'auto',
    width: `${w}px`,
    height: `${h}px`,
    transform: 'translate(-50%, -50%)',
    transformOrigin: 'center center',
    background,
    imageRendering: 'pixelated',
  }
}

/**
 * Edit-mode canvas: native-resolution slice with no CSS transform.
 * Framebuffer size is driven by {@link editorResizeSurface} (Phase 6).
 */
export function runtimeCanvasEditStyle(params: Readonly<{
  cssWidth: number
  cssHeight: number
  background: string
  pointerEvents?: 'auto' | 'none'
}>): Partial<CSSStyleDeclaration> {
  const { cssWidth, cssHeight, background, pointerEvents } = params
  return {
    display: 'block',
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: `${Math.max(1, cssWidth)}px`,
    height: `${Math.max(1, cssHeight)}px`,
    transform: 'none',
    transformOrigin: '0 0',
    background,
    imageRendering: 'auto',
    zIndex: '0',
    ...(pointerEvents ? { pointerEvents } : {}),
  }
}

export function applyRuntimeCanvasPresentation(
  canvas: HTMLCanvasElement,
  style: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(canvas.style, style)
}
