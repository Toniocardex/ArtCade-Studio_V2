import { runtimeAssetPath, WASM_BINARY_URL } from './runtime-path'

// ---------------------------------------------------------------------------
// wasm-bridge.ts — React ↔ C++ WASM bridge
//
// Architecture (Guida_Architettura_e_SmokeTest_ArtCade):
//
//   C++ → React : EM_ASM calls globalThis.on* globals
//                 (set here BEFORE game.js loads so the callback is ready)
//
//   React → C++ : Module.ccall('function_name', returnType, argTypes, args)
//                 Calls EMSCRIPTEN_KEEPALIVE exported C functions.
//
// WASM singleton: game.js (Emscripten) must be injected ONCE per globalThis.
// React StrictMode / HMR remounts must not re-append the script (game.js
// redeclaration crash + audio buffer loop).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Emscripten Module type
// ---------------------------------------------------------------------------

export interface ArtCadeModule {
  onRuntimeInitialized?: () => void
  calledRun: boolean
  canvas: HTMLCanvasElement

  locateFile?: (path: string, prefix: string) => string

  ccall(name: string, returnType: string | null, argTypes: string[], args: unknown[]): unknown
  cwrap(name: string, returnType: string | null, argTypes: string[]): (...args: unknown[]) => unknown
  UTF8ToString(ptr: number): string
  lengthBytesUTF8(str: string): number
  stringToUTF8(str: string, ptr: number, maxBytes: number): void
  _malloc(size: number): number
  _free(ptr: number): void
  HEAPU8: Uint8Array

  print?:    (text: string) => void
  printErr?: (text: string) => void
}

declare global {
  interface Window {
    Module?: Partial<ArtCadeModule>

    onEntitySelected?:            (entityId: number) => void
    onEntityTransformChanged?:    (entityId: number, x: number, y: number,
                                   rot: number, sx: number, sy: number) => void
    onConsoleLine?:               (message: string, level: string) => void
    onTilemapPainted?:            (col: number, row: number, tileId: number) => void
    onSpriteFillColor?:           (entityId: number, r: number, g: number, b: number) => void
    onEditorCursorWorld?:         (x: number, y: number) => void
  }
}

/** Emscripten + C++→JS callbacks live on `globalThis` (browser `window`). */
function emscriptenGlobal(): Window {
  return globalThis as unknown as Window
}

// ---------------------------------------------------------------------------
// Internal state — WASM singleton
// ---------------------------------------------------------------------------

const WASM_SCRIPT_ID = 'artcade-raylib-wasm-script'

let _module: ArtCadeModule | null = null
let _ready  = false
let wasmInitPromise: Promise<ArtCadeModule> | null = null
let wasmWarmPromise: Promise<void> | null = null
let _lastBridgeError: string | null = null

/**
 * Start fetching game.wasm before loadWasmRuntime (pairs with index.html preload).
 * Emscripten still loads via game.js; this warms the HTTP cache for locateFile('game.wasm').
 */
export function warmWasmBinary(): Promise<void> {
  if (wasmWarmPromise) return wasmWarmPromise
  wasmWarmPromise = fetch(WASM_BINARY_URL, { credentials: 'same-origin' })
    .then(() => undefined)
    .catch((err) => {
      console.warn('[wasm-bridge] WASM preload fetch failed (non-fatal):', err)
    })
  return wasmWarmPromise
}

/** Last JS-side failure from `safeCall` / `editorReloadScript` (not C++ Lua errors). */
export function peekWasmBridgeLastError(): string | null {
  return _lastBridgeError
}

/** Mirrors C++ `ArtCade::EditorApiResult`. */
export const EditorApiResult = {
  Ok: 0,
  JsonError: 1,
  LuaError: 2,
  NotWired: 3,
} as const

/** `ccall` transport failure (distinct from C++ return codes). */
export const EDITOR_API_CCALL_FAILED = -1

/**
 * True only after Emscripten finished startup (onRuntimeInitialized + main).
 * `ccall` exists earlier — calling exports before `calledRun` throws "func is not a function".
 */
function isWasmModuleReady(): boolean {
  const mod = emscriptenGlobal().Module
  return typeof mod?.ccall === 'function' && mod.calledRun === true
}

/** After Vite HMR replaces this module, re-link to an already-running Emscripten instance. */
function rehydrateFromWindow(): void {
  if (isWasmModuleReady()) {
    _module = emscriptenGlobal().Module as ArtCadeModule
    _ready  = true
  }
}

rehydrateFromWindow()

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    rehydrateFromWindow()
  })
}

export function getModule(): ArtCadeModule | null { return _module }
export function isReady():   boolean              { return _ready  }

function wasmScriptInDom(): boolean {
  return document.getElementById(WASM_SCRIPT_ID) != null
}

function cacheQuery(): string {
  return import.meta.env.DEV ? `?v=${Date.now()}` : ''
}

/**
 * Bind C++→JS callbacks onto `window`. Required callbacks are always
 * (re)assigned; OPTIONAL callbacks (e.g. `onTilemapPainted`) are only
 * overwritten when explicitly provided.
 *
 * Why: callers like `PreviewPanel` invoke `loadWasmRuntime` again on canvas
 * rebind. If that rebind happens with a partial callback set, naively
 * assigning `globalThis.onTilemapPainted = cbs.onTilemapPainted` would
 * silently set it to `undefined`, breaking tilemap-paint persistence into
 * React (P1 in TECHNICAL_DEBT_REVIEW.md).
 */
export function bindWindowCallbacks(cbs: Partial<WasmCallbacks>): void {
  const g = emscriptenGlobal()
  if (cbs.onEntitySelected)         g.onEntitySelected         = cbs.onEntitySelected
  if (cbs.onEntityTransformChanged) g.onEntityTransformChanged = cbs.onEntityTransformChanged
  if (cbs.onConsoleLine)            g.onConsoleLine            = cbs.onConsoleLine
  if (cbs.onTilemapPainted)         g.onTilemapPainted         = cbs.onTilemapPainted
  if (cbs.onSpriteFillColor)        g.onSpriteFillColor        = cbs.onSpriteFillColor
  if (cbs.onEditorCursorWorld)      g.onEditorCursorWorld      = cbs.onEditorCursorWorld
  // NOTE: the legacy `globalThis.onObjectUpdated(x, y)` forwarder was removed.
  // The shipping C++ runtime never emits that signal (only the smoke-test
  // harness does); meanwhile the forwarder was synthesising entityId=0,
  // rotation=0, scale=(1,1), which — if the C++ side ever did fire it again
  // — would silently reset the selected entity's rotation and scale in the
  // React store. Re-add a properly-shaped binding the day the runtime ships
  // that channel.
}

function attachModuleHooks(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
): void {
  const cacheBust = cacheQuery()
  const g = emscriptenGlobal()
  const existing = g.Module ?? {}
  const prevOnRuntimeInitialized = existing.onRuntimeInitialized

  g.Module = {
    ...existing,
    canvas,
    locateFile: (path: string, _prefix: string) => `${runtimeAssetPath(path)}${cacheBust}`,

    onRuntimeInitialized() {
      if (typeof prevOnRuntimeInitialized === 'function') {
        prevOnRuntimeInitialized.call(g.Module)
      }
      _module = g.Module as ArtCadeModule
      _ready  = true

      _module.print    = (t) => cbs.onConsoleLine(t, 'info')
      _module.printErr = (t) => cbs.onConsoleLine(t, 'error')

      safeCall('editor_set_mode', null, ['number'], [0])
      cbs.onReady()
    },
  }

  // Runtime may already be up (HMR / StrictMode remount / script tag left in DOM).
  if (isWasmModuleReady()) {
    _module = emscriptenGlobal().Module as ArtCadeModule
    _ready  = true
    _module.canvas = canvas
    _module.print    = (t) => cbs.onConsoleLine(t, 'info')
    _module.printErr = (t) => cbs.onConsoleLine(t, 'error')
    safeCall('editor_set_mode', null, ['number'], [0])
    queueMicrotask(() => cbs.onReady())
  }
}

function adoptExistingRuntime(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
): ArtCadeModule {
  const mod = emscriptenGlobal().Module as ArtCadeModule
  _module = mod
  _ready  = true
  mod.canvas = canvas
  mod.print    = (t) => cbs.onConsoleLine(t, 'info')
  mod.printErr = (t) => cbs.onConsoleLine(t, 'error')
  safeCall('editor_set_mode', null, ['number'], [0])
  queueMicrotask(() => cbs.onReady())
  return mod
}

// ---------------------------------------------------------------------------
// String marshalling
// ---------------------------------------------------------------------------

export function marshalString(str: string): number {
  if (!_module) throw new Error('[wasm-bridge] Module not loaded')
  const bytes = _module.lengthBytesUTF8(str) + 1
  const ptr   = _module._malloc(bytes)
  _module.stringToUTF8(str, ptr, bytes)
  return ptr
}

// ---------------------------------------------------------------------------
// loadWasmRuntime — singleton entry (returns shared promise)
// ---------------------------------------------------------------------------

export interface WasmCallbacks {
  onReady:                  () => void
  onEntitySelected:         (entityId: number) => void
  onEntityTransformChanged: (entityId: number, x: number, y: number,
                             rot: number, sx: number, sy: number) => void
  onConsoleLine:            (message: string, level: string) => void
  onTilemapPainted?:        (col: number, row: number, tileId: number) => void
  onSpriteFillColor?:       (entityId: number, r: number, g: number, b: number) => void
  onEditorCursorWorld?:     (x: number, y: number) => void
}

/**
 * Load game.js once per globalThis. Safe under React StrictMode and Vite HMR.
 */
export function loadWasmRuntime(
  canvas:  HTMLCanvasElement,
  gameSrc: string,
  cbs:     WasmCallbacks,
): Promise<ArtCadeModule> {
  bindWindowCallbacks(cbs)

  if (_ready && _module) {
    _module.canvas = canvas
    queueMicrotask(() => cbs.onReady())
    return Promise.resolve(_module)
  }

  if (isWasmModuleReady()) {
    console.log('[wasm-bridge] Engine already in memory — skip script inject.')
    return Promise.resolve(adoptExistingRuntime(canvas, cbs))
  }

  if (wasmScriptInDom()) {
    console.log('[wasm-bridge] Script tag present — waiting for / reusing Module.')
    if (isWasmModuleReady()) {
      return Promise.resolve(adoptExistingRuntime(canvas, cbs))
    }
    if (wasmInitPromise) {
      return wasmInitPromise.then((mod) => {
        mod.canvas = canvas
        queueMicrotask(() => cbs.onReady())
        return mod
      })
    }
    attachModuleHooks(canvas, cbs)
    wasmInitPromise = new Promise((resolve, reject) => {
      const deadline = Date.now() + 30_000
      const tick = () => {
        if (isWasmModuleReady()) {
          resolve(adoptExistingRuntime(canvas, cbs))
          return
        }
        if (Date.now() > deadline) {
          wasmInitPromise = null
          reject(new Error('[wasm-bridge] Timeout waiting for existing game.js'))
          return
        }
        requestAnimationFrame(tick)
      }
      tick()
    })
    return wasmInitPromise
  }

  if (wasmInitPromise) {
    return wasmInitPromise.then((mod) => {
      mod.canvas = canvas
      bindWindowCallbacks(cbs)
      queueMicrotask(() => cbs.onReady())
      return mod
    })
  }

  attachModuleHooks(canvas, cbs)

  wasmInitPromise = new Promise<ArtCadeModule>((resolve, reject) => {
    const script   = document.createElement('script')
    script.id      = WASM_SCRIPT_ID
    script.src     = `${gameSrc}${cacheQuery()}`
    script.async   = true

    script.onload = () => {
      console.log('[wasm-bridge] game.js loaded.')
      const deadline = Date.now() + 30_000
      const tick = () => {
        if (isWasmModuleReady()) {
          resolve(adoptExistingRuntime(canvas, cbs))
          return
        }
        if (Date.now() > deadline) {
          wasmInitPromise = null
          reject(new Error('[wasm-bridge] Module not ready after game.js onload'))
          return
        }
        requestAnimationFrame(tick)
      }
      tick()
    }

    script.onerror = () => {
      wasmInitPromise = null
      script.remove()
      const message = `[wasm-bridge] Failed to load WASM runtime from "${gameSrc}"`
      console.error(message)
      reject(new Error(message))
    }

    document.body.appendChild(script)
  })

  return wasmInitPromise
}

/** Alias for docs / callers that prefer the singleton name. */
export function initWasmEngine(
  scriptUrl: string,
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
): Promise<ArtCadeModule> {
  return loadWasmRuntime(canvas, scriptUrl, cbs)
}

// ---------------------------------------------------------------------------
// Internal ccall helper
// ---------------------------------------------------------------------------

function safeCall(
  name:       string,
  returnType: string | null,
  argTypes:   string[],
  args:       unknown[],
): boolean {
  if (!_module?.ccall || !_module.calledRun) {
    _lastBridgeError = 'WASM runtime is not initialized (ccall unavailable).'
    return false
  }
  try {
    _module.ccall(name, returnType, argTypes, args)
    _lastBridgeError = null
    return true
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    _lastBridgeError = `Runtime call '${name}' failed: ${detail}`
    console.warn(`[wasm-bridge] ccall('${name}') failed:`, err)
    return false
  }
}

function safeCcallNumber(
  name:     string,
  argTypes: string[],
  args:     unknown[],
): number {
  if (!_module?.ccall || !_module.calledRun) {
    _lastBridgeError = 'WASM runtime is not initialized (ccall unavailable).'
    return EDITOR_API_CCALL_FAILED
  }
  try {
    const value = _module.ccall(name, 'number', argTypes, args) as number
    _lastBridgeError = null
    return value
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    _lastBridgeError = `Runtime call '${name}' failed: ${detail}`
    console.warn(`[wasm-bridge] ccall('${name}') failed:`, err)
    return EDITOR_API_CCALL_FAILED
  }
}

function marshalThreeStrings(
  a: string,
  b: string,
  c: string,
): { ptrs: [number, number, number]; free: () => void } {
  if (!_module) throw new Error('[wasm-bridge] Module not loaded')
  const ptrA = marshalString(a)
  const ptrB = marshalString(b)
  const ptrC = marshalString(c)
  return {
    ptrs: [ptrA, ptrB, ptrC],
    free: () => {
      _module!._free(ptrA)
      _module!._free(ptrB)
      _module!._free(ptrC)
    },
  }
}

// ---------------------------------------------------------------------------
// React → C++ command wrappers
// ---------------------------------------------------------------------------

export function editorSetMode(mode: 0 | 1): void {
  safeCall('editor_set_mode', null, ['number'], [mode])
}

export function editorSelectEntity(entityId: number): void {
  safeCall('editor_select_entity', null, ['number'], [entityId])
}

export function editorDeselect(): void {
  safeCall('editor_deselect', null, [], [])
}

export function editorLoadProject(projectJson: string): void {
  if (!_module) return
  const ptr = marshalString(projectJson)
  try {
    safeCall('editor_load_project', null, ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
}

export function editorRestoreFromProject(projectJson: string): void {
  if (!_module) return
  const ptr = marshalString(projectJson)
  try {
    safeCall('editor_restore_from_project', null, ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
}

/** @returns EditorApiResult, or EDITOR_API_CCALL_FAILED on transport error. */
export function editorReloadScript(luaSource: string): number {
  if (!_module) {
    _lastBridgeError = 'WASM module is not loaded.'
    return EDITOR_API_CCALL_FAILED
  }
  const ptr = marshalString(luaSource)
  try {
    return safeCcallNumber('editor_reload_script', ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
}

/** Atomic PLAY — project JSON, main Lua, dialog library JSON. */
export function editorEnterPlayMode(
  projectJson: string,
  luaSource: string,
  dialogsJson: string,
): number {
  if (!_module) {
    _lastBridgeError = 'WASM module is not loaded.'
    return EDITOR_API_CCALL_FAILED
  }
  const { ptrs, free } = marshalThreeStrings(projectJson, luaSource, dialogsJson)
  try {
    return safeCcallNumber('editor_enter_play_mode', ['number', 'number', 'number'], ptrs)
  } finally {
    free()
  }
}

/** Atomic STOP — restore design project JSON + design-time Lua. */
export function editorExitPlayMode(projectJson: string, luaSource: string): number {
  if (!_module) {
    _lastBridgeError = 'WASM module is not loaded.'
    return EDITOR_API_CCALL_FAILED
  }
  const ptrProject = marshalString(projectJson)
  const ptrLua = marshalString(luaSource)
  try {
    return safeCcallNumber('editor_exit_play_mode', ['number', 'number'], [ptrProject, ptrLua])
  } finally {
    _module._free(ptrProject)
    _module._free(ptrLua)
  }
}

export function editorLoadDialogs(dialogsJson: string): boolean {
  if (!_module) return false
  const ptr = marshalString(dialogsJson)
  try {
    return safeCall('editor_load_dialogs', null, ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
}

export function editorRegisterImage(
  path: string,
  bytes: Uint8Array,
  ext: string,
): boolean {
  if (!_module || bytes.length === 0) return false
  const pathPtr = marshalString(path)
  const extPtr  = marshalString(ext)
  const dataPtr = _module._malloc(bytes.length)
  try {
    _module.HEAPU8.set(bytes, dataPtr)
    return safeCall(
      'editor_register_image',
      null,
      ['number', 'number', 'number', 'number'],
      [pathPtr, dataPtr, bytes.length, extPtr],
    )
  } finally {
    _module._free(dataPtr)
    _module._free(extPtr)
    _module._free(pathPtr)
  }
}

export function editorRegisterAudio(
  path: string,
  bytes: Uint8Array,
  ext: string,
): boolean {
  if (!_module || bytes.length === 0) return false
  const pathPtr = marshalString(path)
  const extPtr  = marshalString(ext)
  const dataPtr = _module._malloc(bytes.length)
  try {
    _module.HEAPU8.set(bytes, dataPtr)
    return safeCall(
      'editor_register_audio',
      null,
      ['number', 'number', 'number', 'number'],
      [pathPtr, dataPtr, bytes.length, extPtr],
    )
  } finally {
    _module._free(dataPtr)
    _module._free(extPtr)
    _module._free(pathPtr)
  }
}

export function editorRegisterFont(
  path: string,
  bytes: Uint8Array,
  ext: string,
  baseSize: number,
): boolean {
  if (!_module || bytes.length === 0) return false
  const pathPtr = marshalString(path)
  const extPtr = marshalString(ext)
  const dataPtr = _module._malloc(bytes.length)
  try {
    _module.HEAPU8.set(bytes, dataPtr)
    return safeCall(
      'editor_register_font',
      null,
      ['number', 'number', 'number', 'number', 'number'],
      [pathPtr, dataPtr, bytes.length, extPtr, baseSize],
    )
  } finally {
    _module._free(dataPtr)
    _module._free(extPtr)
    _module._free(pathPtr)
  }
}

export function editorInvalidateAsset(assetKey: string, type: 'image' | 'audio' | 'font'): void {
  if (!_module) return
  const keyPtr = marshalString(assetKey)
  const typePtr = marshalString(type)
  try {
    safeCall('editor_invalidate_asset', null, ['number', 'number'], [keyPtr, typePtr])
  } finally {
    _module._free(typePtr)
    _module._free(keyPtr)
  }
}

export function editorSetTilePaintMode(enabled: boolean): void {
  safeCall('editor_set_tile_paint_mode', null, ['number'], [enabled ? 1 : 0])
}

export function editorSetSelectedTile(tileId: number): void {
  safeCall('editor_set_selected_tile', null, ['number'], [tileId])
}

export function editorSetTool(toolId: number): void {
  safeCall('editor_set_tool', null, ['number'], [toolId])
}

export function editorSetGuidesEnabled(enabled: boolean): void {
  safeCall('editor_set_guides_enabled', null, ['number'], [enabled ? 1 : 0])
}

export function editorSetGridSize(tileSize: number): void {
  safeCall('editor_set_grid_size', null, ['number'], [tileSize])
}

export function editorSetSnapToGrid(enabled: boolean): void {
  safeCall('editor_set_snap_to_grid', null, ['number'], [enabled ? 1 : 0])
}

export function editorSetTransform(
  entityId: number,
  x: number, y: number,
  rotation: number,
  scaleX: number, scaleY: number,
): void {
  safeCall('editor_set_transform', null,
    ['number', 'number', 'number', 'number', 'number', 'number'],
    [entityId, x, y, rotation, scaleX, scaleY])
}

export function editorUpdateEntity(entityId: number, entityJson: string): void {
  if (!_module) return
  const ptr = marshalString(entityJson)
  try {
    safeCall('editor_update_entity', null, ['number', 'number'], [entityId, ptr])
  } finally {
    _module._free(ptr)
  }
}

export function editorOpenRayTint(entityId: number): void {
  safeCall('editor_open_raytint', null, ['number'], [entityId])
}

export function editorCloseRayTint(apply: boolean): void {
  safeCall('editor_close_raytint', null, ['number'], [apply ? 1 : 0])
}

export function editorSetSceneSettings(sceneId: string, sceneJson: string): void {
  if (!_module) return
  const idPtr = marshalString(sceneId)
  const jsonPtr = marshalString(sceneJson)
  try {
    safeCall('editor_set_scene_settings', null, ['number', 'number'], [idPtr, jsonPtr])
  } finally {
    _module._free(jsonPtr)
    _module._free(idPtr)
  }
}

// All cross-channel sync orchestration now lives in
// `utils/runtime-sync-service.ts`. The thin per-channel wrappers above remain
// here as the low-level bridge to the WASM exports.
