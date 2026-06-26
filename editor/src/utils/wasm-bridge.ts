import { runtimeAssetPath, WASM_BINARY_URL } from './runtime-path'
import { parsePresentationSnapshotWasm, type PresentationSnapshot } from './presentation-snapshot'

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
  HEAPF32: Float32Array

  print?:    (text: string) => void
  printErr?: (text: string) => void
}

declare global {
  interface Window {
    Module?: Partial<ArtCadeModule>

    onEntitySelected?:            (entityId: number) => void
    onEntityDuplicateRequested?:  (entityId: number, x: number, y: number) => void
    onEntityTransformChanged?:    (entityId: number, x: number, y: number,
                                   rot: number, sx: number, sy: number) => void
    onConsoleLine?:               (message: string, level: string) => void
    onRuntimeProfile?:            (
      fps: number,
      luaMs: number,
      physicsMs: number,
      renderMs: number,
      entityCount: number,
      physicsBodies: number,
    ) => void
    onEditorCursorWorld?:         (x: number, y: number) => void
  /** Spritesheet Studio engine preview (one frame per main-loop tick). */
    onSpritesheetPreviewFrame?:   (
      status: number,
      width: number,
      height: number,
      rgba: Uint8ClampedArray | 0,
    ) => void
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
/** Fired after any C++ call that invokes evictCachedAssets() (project load / play / stop). */
let _onTextureCacheEvicted: (() => void) | null = null

/**
 * Register a callback that runs whenever the WASM renderer evicts all cached textures.
 * The registered function must call `assetOrchestrator.clearRegistered()` so the JS
 * asset registry stays in sync with the C++ texture cache.
 * Pass `null` to unregister (e.g. on component unmount).
 */
export function setTextureCacheEvictedCallback(fn: (() => void) | null): void {
  _onTextureCacheEvicted = fn
}

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
 * (re)assigned; optional callbacks are only overwritten when explicitly provided.
 *
 * Why: callers like `PreviewPanel` invoke `loadWasmRuntime` again on canvas
 * rebind. If that rebind happens with a partial callback set, naively assigning
 * optional handlers would silently set them to `undefined`.
 */
export function bindWindowCallbacks(cbs: Partial<WasmCallbacks>): void {
  const g = emscriptenGlobal()
  if (cbs.onEntitySelected)         g.onEntitySelected         = cbs.onEntitySelected
  if (cbs.onEntityDuplicateRequested) {
    g.onEntityDuplicateRequested = cbs.onEntityDuplicateRequested
  }
  if (cbs.onEntityTransformChanged) g.onEntityTransformChanged = cbs.onEntityTransformChanged
  if (cbs.onConsoleLine)            g.onConsoleLine            = cbs.onConsoleLine
  if (cbs.onRuntimeProfile)         g.onRuntimeProfile         = cbs.onRuntimeProfile
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
  onInitialized?: (module: ArtCadeModule) => void,
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
      onInitialized?.(_module)
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
    queueMicrotask(() => {
      cbs.onReady()
      onInitialized?.(_module as ArtCadeModule)
    })
  }
}

function waitForRuntimeInitialization(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
  timeoutMessage: string,
): Promise<ArtCadeModule> {
  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      wasmInitPromise = null
      reject(new Error(timeoutMessage))
    }, 30_000)
    attachModuleHooks(canvas, cbs, (module) => {
      globalThis.clearTimeout(timeoutId)
      resolve(module)
    })
  })
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
  onEntityDuplicateRequested: (entityId: number, x: number, y: number) => void
  onEntityTransformChanged: (entityId: number, x: number, y: number,
                             rot: number, sx: number, sy: number) => void
  onConsoleLine:            (message: string, level: string) => void
  onRuntimeProfile?:        (
    fps: number,
    luaMs: number,
    physicsMs: number,
    renderMs: number,
    entityCount: number,
    physicsBodies: number,
  ) => void
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
    wasmInitPromise = waitForRuntimeInitialization(
      canvas,
      cbs,
      '[wasm-bridge] Timeout waiting for existing game.js',
    )
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

  wasmInitPromise = new Promise<ArtCadeModule>((resolve, reject) => {
    const script   = document.createElement('script')
    script.id      = WASM_SCRIPT_ID
    script.src     = `${gameSrc}${cacheQuery()}`
    script.async   = true

    const timeoutId = globalThis.setTimeout(() => {
      wasmInitPromise = null
      reject(new Error('[wasm-bridge] Module not ready after loading game.js'))
    }, 30_000)
    attachModuleHooks(canvas, cbs, (module) => {
      globalThis.clearTimeout(timeoutId)
      resolve(module)
    })

    script.onload = () => console.log('[wasm-bridge] game.js loaded.')

    script.onerror = () => {
      globalThis.clearTimeout(timeoutId)
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

function safeCcallString(name: string, argTypes: string[], args: unknown[]): string | null {
  if (!_module?.ccall || !_module.calledRun) return null
  try {
    return _module.ccall(name, 'string', argTypes, args) as string
  } catch (err) {
    console.warn(`[wasm-bridge] ccall('${name}') failed:`, err)
    return null
  }
}

export type RuntimeVariableSnapshot = {
  globals: Record<string, number | boolean | string>
  locals: Record<string, number | boolean | string>
}

export function editorGetVariables(entityId = 0): RuntimeVariableSnapshot | null {
  const raw = safeCcallString('editor_get_variables_json', ['number'], [entityId])
  if (!raw) return null
  try {
    return JSON.parse(raw) as RuntimeVariableSnapshot
  } catch {
    return null
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

export function editorSelectEntities(entityIds: readonly number[]): void {
  const csv = entityIds
    .filter((id) => Number.isInteger(id) && id > 0)
    .join(',')
  safeCall('editor_select_entities', null, ['string'], [csv])
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
  _onTextureCacheEvicted?.()
}

export function editorRestoreFromProject(projectJson: string): void {
  if (!_module) return
  const ptr = marshalString(projectJson)
  try {
    safeCall('editor_restore_from_project', null, ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
  _onTextureCacheEvicted?.()
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
  let code = EDITOR_API_CCALL_FAILED
  try {
    code = safeCcallNumber('editor_enter_play_mode', ['number', 'number', 'number'], ptrs)
  } finally {
    free()
  }
  // Edit→play keeps the asset set identical, so the C++ runtime no longer evicts
  // its texture/sound caches on this transition (applyEditorEnterPlay). Firing the
  // eviction callback here would drop the JS registry and force a needless async
  // re-upload — the very window that flashed the placeholder square on first play.
  return code
}

/** Atomic STOP — restore design project JSON + design-time Lua. */
export function editorExitPlayMode(projectJson: string, luaSource: string): number {
  if (!_module) {
    _lastBridgeError = 'WASM module is not loaded.'
    return EDITOR_API_CCALL_FAILED
  }
  const ptrProject = marshalString(projectJson)
  const ptrLua = marshalString(luaSource)
  let code = EDITOR_API_CCALL_FAILED
  try {
    code = safeCcallNumber('editor_exit_play_mode', ['number', 'number'], [ptrProject, ptrLua])
  } finally {
    _module._free(ptrProject)
    _module._free(ptrLua)
  }
  // Play→edit reuses the same textures (applyEditorExitPlay no longer evicts), so
  // we keep the JS registry too — no eviction callback, no redundant re-upload.
  return code
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

/** @returns 0 on success, negative on failure. */
export function editorReregisterAnimationClips(assetsJson: string): number {
  if (!_module) return -1
  const ptr = marshalString(assetsJson)
  try {
    return safeCcallNumber('editor_reregister_animation_clips', ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
}

export function editorPreviewSpritesheetReset(): void {
  safeCall('editor_preview_spritesheet_reset', null, [], [])
}

/**
 * Queue one Spritesheet Studio preview frame (rasterized on the engine main loop).
 * @returns 0 when queued, negative on invalid arguments.
 */
export function editorPreviewSpritesheetSubmit(
  texturePath: string,
  clipName: string,
  dtSeconds: number,
  width: number,
  height: number,
): number {
  if (!_module) return -1
  const pathPtr = marshalString(texturePath)
  const clipPtr = marshalString(clipName)
  try {
    return safeCcallNumber(
      'editor_preview_spritesheet_submit',
      ['number', 'number', 'number', 'number', 'number'],
      [pathPtr, clipPtr, dtSeconds, width, height],
    )
  } finally {
    _module._free(clipPtr)
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

/** Write a single tilemap cell directly — no texture eviction, no full project reload.
 *  When @p layerName is set, targets that tilemapLayers grid (multi-layer render). */
export function editorPaintTile(
  col: number,
  row: number,
  tileId: number,
  layerName?: string,
  sourceIndex = 0,
  tilesetAssetId?: string,
): void {
  const layerPtr = layerName ? marshalString(layerName) : 0
  const tilesetPtr = tilesetAssetId ? marshalString(tilesetAssetId) : 0
  try {
    safeCall(
      'editor_paint_tile',
      null,
      ['number', 'number', 'number', 'number', 'number', 'number'],
      [col, row, tileId, layerPtr, sourceIndex, tilesetPtr],
    )
  } finally {
    if (tilesetPtr) _module!._free(tilesetPtr)
    if (layerPtr) _module!._free(layerPtr)
  }
}

/** Push merged tilemap.data into the active scene without evicting textures.
 *  Returns true if the WASM function exists and the call succeeded; false if the
 *  runtime was not rebuilt yet (caller should fall back to editorLoadProject). */
export function editorSyncTilemapData(data: number[]): boolean {
  if (!_module) return false
  const ptr = marshalString(JSON.stringify(data))
  try {
    return safeCall('editor_sync_tilemap_data', null, ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
}

/** Push per-layer grids + merged data for multi-layer tilemap rendering. */
export function editorSyncTilemapLayers(payload: {
  layerIds: string[]
  tilemapLayers: Record<string, unknown>
  mergedData: number[]
}): boolean {
  if (!_module) return false
  const ptr = marshalString(JSON.stringify(payload))
  try {
    return safeCall('editor_sync_tilemap_layers', null, ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
}

/** C++ native tile-paint path: active layer name for paintTileAt. */
export function editorSetActiveTileLayer(layerName: string): void {
  if (!_module) return
  const ptr = marshalString(layerName)
  try {
    safeCall('editor_set_active_tile_layer', null, ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
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

/**
 * Drive the edit-mode preview camera (screen-resolution rendering).
 * @deprecated Phase 6 — prefer {@link editorResizeSurface} + ViewController intents.
 */
export function editorSetEditCamera(
  targetX: number, targetY: number, zoom: number, vpW: number, vpH: number,
): void {
  safeCall(
    'editor_set_edit_camera', null,
    ['number', 'number', 'number', 'number', 'number'],
    [targetX, targetY, zoom, Math.round(vpW), Math.round(vpH)],
  )
}

/** Fixed-surface editor viewport resize (Phase 6). */
export function editorResizeSurface(cssW: number, cssH: number, devicePixelRatio: number): void {
  safeCall(
    'editor_resize_surface', null,
    ['number', 'number', 'number'],
    [cssW, cssH, devicePixelRatio],
  )
}

export function editorBeginPan(cssX: number, cssY: number): void {
  safeCall('editor_begin_pan', null, ['number', 'number'], [cssX, cssY])
}

export function editorUpdatePan(cssX: number, cssY: number): void {
  safeCall('editor_update_pan', null, ['number', 'number'], [cssX, cssY])
}

export function editorEndPan(): void {
  safeCall('editor_end_pan', null, [], [])
}

export function editorZoomAt(cssX: number, cssY: number, zoomFactor: number): void {
  safeCall('editor_zoom_at', null, ['number', 'number', 'number'], [cssX, cssY, zoomFactor])
}

export function editorFrameWorldBounds(
  minX: number, minY: number, maxX: number, maxY: number,
): void {
  safeCall(
    'editor_frame_world_bounds', null,
    ['number', 'number', 'number', 'number'],
    [minX, minY, maxX, maxY],
  )
}

export type EditorViewState = Readonly<{ x: number; y: number; zoomDevice: number }>

/** Editor camera top-left world position + device-px-per-world zoom. */
export function editorReadEditorView(): EditorViewState {
  const mod = _module
  if (!mod) return { x: 0, y: 0, zoomDevice: 1 }
  const xPtr = mod._malloc(4)
  const yPtr = mod._malloc(4)
  const zPtr = mod._malloc(4)
  try {
    safeCall('editor_get_editor_view', null, ['number', 'number', 'number'], [xPtr, yPtr, zPtr])
    return {
      x: mod.HEAPF32[xPtr >> 2],
      y: mod.HEAPF32[yPtr >> 2],
      zoomDevice: mod.HEAPF32[zPtr >> 2],
    }
  } finally {
    mod._free(xPtr)
    mod._free(yPtr)
    mod._free(zPtr)
  }
}

export function editorSetEditorView(
  targetX: number, targetY: number, zoomDevicePx: number,
): void {
  safeCall(
    'editor_set_editor_view', null,
    ['number', 'number', 'number'],
    [targetX, targetY, zoomDevicePx],
  )
}

/** Committed presentation revision from the WASM presentation core (Phase 2). */
export function editorGetPresentationRevision(): number {
  return Number(safeCall('editor_get_presentation_revision', 'number', [], []) ?? 0)
}

/** Reads the committed presentation snapshot ABI from WASM (Phase 5). */
export function editorReadPresentationSnapshot(): PresentationSnapshot | null {
  const mod = _module
  if (!mod) return null
  const ptr = Number(safeCall('editor_get_presentation_snapshot', 'number', [], []) ?? 0)
  if (!ptr) return null
  return parsePresentationSnapshotWasm(mod.HEAPU8, ptr)
}

/** Surface (framebuffer) → world via committed presentation snapshot. */
export function editorSurfaceToWorld(surfaceX: number, surfaceY: number): { x: number; y: number } {
  const mod = _module
  if (!mod) return { x: surfaceX, y: surfaceY }
  const wxPtr = mod._malloc(4)
  const wyPtr = mod._malloc(4)
  try {
    safeCall(
      'editor_surface_to_world', null,
      ['number', 'number', 'number', 'number'],
      [surfaceX, surfaceY, wxPtr, wyPtr],
    )
    return {
      x: mod.HEAPF32[wxPtr >> 2],
      y: mod.HEAPF32[wyPtr >> 2],
    }
  } finally {
    mod._free(wxPtr)
    mod._free(wyPtr)
  }
}

/** Re-assert play surface after host layout changes (CSS size × DPR, Phase 8). */
export function editorSyncPlaySurface(
  cssW: number,
  cssH: number,
  devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
): void {
  safeCall(
    'editor_sync_play_surface', null,
    ['number', 'number', 'number'],
    [Math.max(1, cssW), Math.max(1, cssH), devicePixelRatio],
  )
}

/** PlayEmbedded / PlayExternal / PlayFullscreen before or during play. */
export function editorSetPlayPresentation(mode: 'playEmbedded' | 'playExternal' | 'playFullscreen'): void {
  const abi = { playEmbedded: 2, playExternal: 3, playFullscreen: 4 } as const
  safeCall('editor_set_play_presentation', null, ['number'], [abi[mode]])
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
