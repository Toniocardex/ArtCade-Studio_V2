// ---------------------------------------------------------------------------
// runtime-canvas — singleton WASM surface + pin-on-body SurfaceBinder
// ---------------------------------------------------------------------------
//
// A WebGLRenderingContext is permanently bound to the canvas it was created on.
// WebView2/ANGLE also stops presenting if the canvas is detached or repeatedly
// re-parented into React hosts. Contract:
//
//   1. One canvas element for the life of the app.
//   2. Parent is always document.body after boot (never React host children).
//   3. SurfaceBinder positions it with position:fixed + host getBoundingClientRect.
//   4. React hosts are measure slots + overlay stacks only.
//
// WASM uses -sOFFSCREEN_FRAMEBUFFER=1 — wakeRuntimeCanvasGl after resize.

const RUNTIME_CANVAS_KEY = '__artcadeRuntimeCanvas'

/** Fixed canvas stacks under DOM overlays (paint / camera frame). */
export const RUNTIME_SURFACE_Z_INDEX = 4

/** DOM overlays above the pinned canvas (must exceed RUNTIME_SURFACE_Z_INDEX). */
export const RUNTIME_SURFACE_OVERLAY_Z_INDEX = 6

/** Minimum CSS viewport edge before we resize the WASM surface. */
export const RUNTIME_SURFACE_MIN_CSS_PX = 32

type EmscriptenGlHost = {
  resizeOffscreenFramebuffer?: (canvas: HTMLCanvasElement) => void
}

type CanvasGlobal = typeof globalThis & {
  [RUNTIME_CANVAS_KEY]?: HTMLCanvasElement
  Module?: { canvas?: HTMLCanvasElement; GL?: EmscriptenGlHost }
  GL?: EmscriptenGlHost
}

type SurfaceBinderState = {
  host: HTMLElement | null
  raf: number
  lastLeft: number
  lastTop: number
  lastW: number
  lastH: number
}

const binder: SurfaceBinderState = {
  host: null,
  raf: 0,
  lastLeft: Number.NaN,
  lastTop: Number.NaN,
  lastW: Number.NaN,
  lastH: Number.NaN,
}

function resetBinderLayoutCache(): void {
  binder.lastLeft = Number.NaN
  binder.lastTop = Number.NaN
  binder.lastW = Number.NaN
  binder.lastH = Number.NaN
}

function emscriptenGl(): EmscriptenGlHost | undefined {
  const g = globalThis as CanvasGlobal
  return g.GL ?? g.Module?.GL
}

/**
 * Rebinds Emscripten Module.canvas and OFFSCREEN_FRAMEBUFFER after resize.
 */
export function wakeRuntimeCanvasGl(canvas: HTMLCanvasElement = getRuntimeCanvas()): void {
  const g = globalThis as CanvasGlobal
  if (g.Module) g.Module.canvas = canvas

  const glModule = emscriptenGl()
  if (canvas.width > 0 && canvas.height > 0 && typeof glModule?.resizeOffscreenFramebuffer === 'function') {
    try {
      glModule.resizeOffscreenFramebuffer(canvas)
    } catch {
      // Non-fatal when GL is not exported yet (stale game.js).
    }
  }
}

function ensurePinnedOnBody(canvas: HTMLCanvasElement): void {
  if (canvas.parentElement !== document.body) {
    document.body.appendChild(canvas)
  }
}

function stopBinderLoop(): void {
  if (binder.raf !== 0) {
    cancelAnimationFrame(binder.raf)
    binder.raf = 0
  }
}

function startBinderLoop(): void {
  if (binder.raf !== 0) return
  const tick = (): void => {
    binder.raf = 0
    if (!binder.host) return
    syncRuntimeSurfaceLayout()
    binder.raf = requestAnimationFrame(tick)
  }
  binder.raf = requestAnimationFrame(tick)
}

/**
 * Positions the body-pinned canvas over the active host rect.
 * Does not change parent — only left/top/width/height/z-index.
 * Skips style/FBO work when the rect is unchanged (binder rAF loop).
 */
export function syncRuntimeSurfaceLayout(
  canvas: HTMLCanvasElement = getRuntimeCanvas(),
): boolean {
  ensurePinnedOnBody(canvas)
  const host = binder.host
  if (!host || !host.isConnected) return false

  const rect = host.getBoundingClientRect()
  const left = Math.round(rect.left)
  const top = Math.round(rect.top)
  const w = Math.max(1, Math.round(rect.width))
  const h = Math.max(1, Math.round(rect.height))
  const sizeChanged = w !== binder.lastW || h !== binder.lastH
  const moved = left !== binder.lastLeft || top !== binder.lastTop
  if (!sizeChanged && !moved) {
    return w >= RUNTIME_SURFACE_MIN_CSS_PX && h >= RUNTIME_SURFACE_MIN_CSS_PX
  }

  binder.lastLeft = left
  binder.lastTop = top
  binder.lastW = w
  binder.lastH = h

  canvas.style.position = 'fixed'
  canvas.style.left = `${left}px`
  canvas.style.top = `${top}px`
  canvas.style.right = 'auto'
  canvas.style.bottom = 'auto'
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  canvas.style.margin = '0'
  canvas.style.transform = 'none'
  canvas.style.transformOrigin = '0 0'
  canvas.style.zIndex = String(RUNTIME_SURFACE_Z_INDEX)
  canvas.style.display = 'block'
  if (sizeChanged) wakeRuntimeCanvasGl(canvas)
  return w >= RUNTIME_SURFACE_MIN_CSS_PX && h >= RUNTIME_SURFACE_MIN_CSS_PX
}

/**
 * Binds the singleton surface to a measure host. Canvas stays on document.body.
 * @returns true when the host is connected and layout was applied
 */
export function bindRuntimeSurfaceToHost(
  host: HTMLElement | null | undefined,
  canvas: HTMLCanvasElement = getRuntimeCanvas(),
): boolean {
  if (!host || !host.isConnected) return false
  ensurePinnedOnBody(canvas)
  if (binder.host !== host) resetBinderLayoutCache()
  binder.host = host
  const ok = syncRuntimeSurfaceLayout(canvas)
  startBinderLoop()
  return ok || host.isConnected
}

/**
 * Clears the active host and parks the surface (still on body, not visible).
 * @param host when set, no-ops if a different host is currently bound
 */
export function unbindRuntimeSurface(
  host?: HTMLElement | null,
  canvas: HTMLCanvasElement = getRuntimeCanvas(),
): void {
  if (host != null && binder.host != null && host !== binder.host) return
  stopBinderLoop()
  binder.host = null
  resetBinderLayoutCache()
  parkRuntimeCanvasOnBody(canvas)
}

/**
 * Hides the surface on body without detaching. Used when no host is active.
 */
export function parkRuntimeCanvasOnBody(
  canvas: HTMLCanvasElement = getRuntimeCanvas(),
): void {
  ensurePinnedOnBody(canvas)
  canvas.style.position = 'fixed'
  canvas.style.left = '0'
  canvas.style.top = '0'
  canvas.style.width = '1px'
  canvas.style.height = '1px'
  canvas.style.opacity = '0'
  canvas.style.visibility = 'visible'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '0'
  wakeRuntimeCanvasGl(canvas)
}

/**
 * Aligns the canvas backing store with the CSS viewport, then wakes the FBO.
 */
export function alignRuntimeCanvasFramebuffer(
  cssW: number,
  cssH: number,
  dpr: number,
  canvas: HTMLCanvasElement = getRuntimeCanvas(),
): { fbW: number; fbH: number } {
  const safeDpr = dpr > 0 ? dpr : 1
  const fbW = Math.max(1, Math.round(cssW * safeDpr))
  const fbH = Math.max(1, Math.round(cssH * safeDpr))
  if (canvas.width !== fbW) canvas.width = fbW
  if (canvas.height !== fbH) canvas.height = fbH
  wakeRuntimeCanvasGl(canvas)
  return { fbW, fbH }
}

export function getRuntimeCanvas(): HTMLCanvasElement {
  const g = globalThis as CanvasGlobal
  let canvas = g[RUNTIME_CANVAS_KEY]
  if (!(canvas instanceof HTMLCanvasElement)) {
    canvas = document.createElement('canvas')
    canvas.id = 'artcade-canvas'
    g[RUNTIME_CANVAS_KEY] = canvas
  }
  return canvas
}

const BOOT_CANVAS_WIDTH = 1280
const BOOT_CANVAS_HEIGHT = 720

/** Size the singleton canvas before Emscripten/Raylib InitWindow (boot path). */
export function prepareRuntimeCanvasForWasmBoot(canvas: HTMLCanvasElement = getRuntimeCanvas()): void {
  canvas.width = BOOT_CANVAS_WIDTH
  canvas.height = BOOT_CANVAS_HEIGHT
  canvas.style.visibility = 'visible'
  canvas.style.opacity = '1'
}

/**
 * Pin the runtime canvas on document.body before game.js runs main().
 * Never leaves the canvas disconnected — WebView2 stops presenting after detach.
 */
export function ensureRuntimeCanvasForWasmBoot(
  canvas: HTMLCanvasElement = getRuntimeCanvas(),
): HTMLCanvasElement {
  prepareRuntimeCanvasForWasmBoot(canvas)
  ensurePinnedOnBody(canvas)
  canvas.style.position = 'fixed'
  canvas.style.left = '0'
  canvas.style.top = '0'
  canvas.style.width = `${BOOT_CANVAS_WIDTH}px`
  canvas.style.height = `${BOOT_CANVAS_HEIGHT}px`
  canvas.style.opacity = '1'
  canvas.style.visibility = 'visible'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '0'
  return canvas
}
