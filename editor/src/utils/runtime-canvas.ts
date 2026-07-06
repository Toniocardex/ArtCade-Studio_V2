// ---------------------------------------------------------------------------
// runtime-canvas — the one canvas element the WASM engine renders into
// ---------------------------------------------------------------------------
//
// A WebGLRenderingContext is permanently bound to the canvas element it was
// created on. Emscripten/Raylib creates the GL context once, on first init;
// assigning `Module.canvas = otherCanvas` later does NOT move rendering to
// the new element — frames keep going to the original (possibly detached)
// canvas while the new one only shows its CSS background.
//
// PreviewPanel unmounts/remounts on layout-tier changes and view switches,
// and React always creates fresh DOM nodes on remount. So instead of a JSX
// <canvas>, the panel adopts this singleton element into a host div on every
// mount. Re-parenting a canvas preserves its GL context and the input
// listeners Emscripten attached at init.
//
// WASM is built with -sOFFSCREEN_FRAMEBUFFER=1 (see runtime-cpp app CMakeLists).
// After resize or re-parent, Module.GL.resizeOffscreenFramebuffer must run or
// only ClearBackground composites to the visible canvas while world draws stay
// on a stale offscreen buffer.

import { debugSceneLog } from './debug-scene-log'

const RUNTIME_CANVAS_KEY = '__artcadeRuntimeCanvas'

type EmscriptenGlHost = {
  resizeOffscreenFramebuffer?: (canvas: HTMLCanvasElement) => void
}

type CanvasGlobal = typeof globalThis & {
  [RUNTIME_CANVAS_KEY]?: HTMLCanvasElement
  Module?: { canvas?: HTMLCanvasElement; GL?: EmscriptenGlHost }
  GL?: EmscriptenGlHost
}

function emscriptenGl(): EmscriptenGlHost | undefined {
  const g = globalThis as CanvasGlobal
  return g.GL ?? g.Module?.GL
}

/**
 * Rebinds Emscripten to the singleton canvas after DOM re-parent or resize.
 * Required with OFFSCREEN_FRAMEBUFFER so world draws reach the visible canvas.
 */
export function wakeRuntimeCanvasGl(canvas: HTMLCanvasElement = getRuntimeCanvas()): void {
  const g = globalThis as CanvasGlobal
  if (g.Module) g.Module.canvas = canvas

  canvas.style.visibility = 'visible'
  canvas.style.opacity = '1'

  const glModule = emscriptenGl()
  const hasResize = typeof glModule?.resizeOffscreenFramebuffer === 'function'
  // #region agent log
  debugSceneLog('runtime-canvas.ts:wakeRuntimeCanvasGl', 'wake_gl', {
    hasResize,
    hasModuleGl: !!(g.Module?.GL),
    hasGlobalGl: !!g.GL,
    canvasW: canvas.width,
    canvasH: canvas.height,
    moduleCanvasMatch: g.Module?.canvas === canvas,
  }, 'H2')
  // #endregion

  // Keep backing store aligned with Raylib's logical size when already set.
  if (canvas.width > 0 && canvas.height > 0 && hasResize) {
    try {
      glModule!.resizeOffscreenFramebuffer!(canvas)
    } catch {
      // Non-fatal when GL is not exported yet (stale game.js).
    }
  }
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
 * Attach the runtime canvas to document.body before game.js runs main().
 * Raylib/Emscripten needs a connected canvas with backing-store dimensions;
 * waiting for PreviewPanel layout often leaves init too late or on a zero-size host.
 */
export function ensureRuntimeCanvasForWasmBoot(
  canvas: HTMLCanvasElement = getRuntimeCanvas(),
): HTMLCanvasElement {
  prepareRuntimeCanvasForWasmBoot(canvas)
  if (!canvas.isConnected) {
    canvas.style.position = 'fixed'
    canvas.style.left = '0'
    canvas.style.top = '0'
    // CSS size must match backing store — WebView2 can hang WebGL init on 1×1 CSS + large buffer.
    canvas.style.width = `${BOOT_CANVAS_WIDTH}px`
    canvas.style.height = `${BOOT_CANVAS_HEIGHT}px`
    canvas.style.opacity = '1'
    canvas.style.visibility = 'visible'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '0'
    document.body.appendChild(canvas)
  }
  return canvas
}
