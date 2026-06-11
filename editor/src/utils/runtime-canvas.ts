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
// Stored on globalThis (same pattern as the Emscripten Module global in
// wasm-bridge) so a Vite HMR reload of this module cannot mint a second
// canvas while the engine still holds the first.

const RUNTIME_CANVAS_KEY = '__artcadeRuntimeCanvas'

type CanvasGlobal = typeof globalThis & {
  [RUNTIME_CANVAS_KEY]?: HTMLCanvasElement
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
