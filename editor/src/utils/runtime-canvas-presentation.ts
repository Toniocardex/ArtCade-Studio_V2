import type { Vec4 } from '../types'
import type { PresentationSnapshot } from './presentation-snapshot'

/** Logical or physical pixel dimensions for runtime canvas layout. */
export type DisplaySize = Readonly<{ x: number; y: number }>

export const RUNTIME_PLAY_STAGE_PADDING_PX = 16
export const RUNTIME_PLAY_MIN_SCALE = 0.1

export type PlayFitScaleOptions = Readonly<{
  /** Lower bound for fit scale (docked play uses {@link RUNTIME_PLAY_MIN_SCALE}). */
  minScale?: number
  /**
   * When upscaling, floor to an integer factor so CSS scale stays pixel-crisp
   * (floating runtime preview window).
   */
  integerUpscale?: boolean
}>

/**
 * Computes the uniform scale that fits a logical viewport inside available space.
 * @deprecated Prefer {@link playCssScaleFromSnapshot} when a committed snapshot exists (ADR Phase 5).
 * @param logical scene viewport in world pixels (must be > 0 on each axis)
 * @param available host area in CSS pixels
 */
export function playFitScale(
  logical: DisplaySize,
  available: DisplaySize,
  options?: PlayFitScaleOptions,
): number {
  const minScale = options?.minScale ?? 0.01
  const scaleX = available.x / Math.max(1, logical.x)
  const scaleY = available.y / Math.max(1, logical.y)
  let scale = Math.max(minScale, Math.min(scaleX, scaleY))
  if (options?.integerUpscale && scale >= 1) {
    scale = Math.max(1, Math.floor(scale))
  }
  return scale
}

/**
 * Play-mode CSS scale from a committed presentation snapshot (Phase 5).
 * Uses snapshot logical size as authority; honours integer upscale when requested.
 */
export function playCssScaleFromSnapshot(
  snapshot: PresentationSnapshot,
  stageAvailable: DisplaySize,
  options?: PlayFitScaleOptions,
): number {
  const minScale = options?.minScale ?? 0.01
  const logicalW = Math.max(1, snapshot.logical.width)
  const logicalH = Math.max(1, snapshot.logical.height)
  const scaleX = stageAvailable.x / logicalW
  const scaleY = stageAvailable.y / logicalH
  let scale = Math.max(minScale, Math.min(scaleX, scaleY))
  if (options?.integerUpscale && scale >= 1) {
    const integerCap = Math.max(1, Math.floor(snapshot.presentationScale))
    scale = Math.min(scale, integerCap)
    scale = Math.max(1, Math.floor(scale))
  }
  return scale
}

/**
 * Rounded CSS pixel size of a scaled logical viewport (play host container).
 */
export function playDisplaySize(logical: DisplaySize, scale: number): DisplaySize {
  return {
    x: Math.max(1, Math.round(logical.x * scale)),
    y: Math.max(1, Math.round(logical.y * scale)),
  }
}

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
 * Imperative play-mode canvas presentation.
 * Framebuffer size is owned by the runtime ({@link setWindowSize} / NativePlay);
 * CSS only scales the logical viewport to fit the host.
 */
export function runtimeCanvasPlayStyle(params: Readonly<{
  viewport: DisplaySize
  scale: number
  background: string
  layout: RuntimeCanvasPlayLayout
  pointerEvents?: 'auto' | 'none'
}>): Partial<CSSStyleDeclaration> {
  const { viewport, scale, background, layout, pointerEvents } = params
  const common = {
    display: 'block' as const,
    position: 'absolute' as const,
    width: `${viewport.x}px`,
    height: `${viewport.y}px`,
    background,
    imageRendering: 'pixelated' as const,
    ...(pointerEvents ? { pointerEvents } : {}),
  }

  if (layout === 'floating-centered') {
    return {
      ...common,
      inset: 'auto',
      left: '50%',
      top: '50%',
      right: 'auto',
      bottom: 'auto',
      transform: `translate(-50%, -50%) scale(${scale})`,
      transformOrigin: 'center center',
    }
  }

  return {
    ...common,
    top: '0px',
    left: '0px',
    transform: `scale(${scale})`,
    transformOrigin: '0 0',
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
 * Framebuffer size is driven by {@link editorSetEditCamera}.
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
    ...(pointerEvents ? { pointerEvents } : {}),
  }
}

export function applyRuntimeCanvasPresentation(
  canvas: HTMLCanvasElement,
  style: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(canvas.style, style)
}
