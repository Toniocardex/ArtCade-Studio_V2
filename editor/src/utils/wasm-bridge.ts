import { runtimeAssetPath, WASM_BINARY_URL } from './runtime-path'
import { wakeRuntimeCanvasGl, ensureRuntimeCanvasForWasmBoot } from './runtime-canvas'
import { captureBootLine } from './boot-diagnostics'
import {
  parsePresentationSnapshotWasm,
  PRESENTATION_MODE_ABI,
  type PresentationSnapshot,
} from './presentation-snapshot'

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
  postRun?: Array<() => void> | (() => void)
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
  HEAPF32?: Float32Array

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
    onEntityTransformPreview?:   (entityId: number, x: number, y: number,
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
const WASM_BOOT_TIMEOUT_MS = 60_000

let _module: ArtCadeModule | null = null
let _ready  = false
/** True after Emscripten `postRun` (i.e. `main()` has returned). */
let _postRunComplete = false
let wasmInitPromise: Promise<ArtCadeModule> | null = null
let wasmWarmPromise: Promise<void> | null = null
let _lastBridgeError: string | null = null
/** Resolves the active loadWasmRuntime() promise once post-main boot completes. */
let _wasmBootNotify: ((module: ArtCadeModule) => void) | null = null
let _wasmBootReject: ((err: Error) => void) | null = null
let _wasmBootRejected = false
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

/** C++ main() has not recorded an exit code yet (see editor_get_main_exit_code). */
export const WASM_MAIN_EXIT_PENDING = -2

/**
 * True only after Emscripten finished startup (onRuntimeInitialized + main).
 * `ccall` exists earlier — calling exports before `calledRun` throws "func is not a function".
 */
function isWasmModuleReady(): boolean {
  const mod = emscriptenGlobal().Module
  return typeof mod?.ccall === 'function'
    && mod.calledRun === true
    && _postRunComplete
}

/**
 * Boot-time ccall before the readiness latch fires.
 * Emscripten sets `calledRun` when main() starts, not when init finishes.
 */
function rawBootCcallNumber(name: string): number | null {
  const mod = emscriptenGlobal().Module
  if (typeof mod?.ccall !== 'function' || !mod.calledRun) return null
  try {
    return mod.ccall(name, 'number', [], []) as number
  } catch {
    return null
  }
}

/** True once C++ Application::run finished init (success or failure). */
function isCppMainFinished(): boolean {
  const wired = rawBootCcallNumber('editor_is_engine_wired')
  if (wired === 1) return true
  const exitCode = rawBootCcallNumber('editor_get_main_exit_code')
  if (exitCode === null) return false
  if (exitCode === WASM_MAIN_EXIT_PENDING) return false
  // Legacy WASM builds used -1 before Application::run recorded 0/1.
  if (exitCode === EDITOR_API_CCALL_FAILED && wired !== 1) return false
  return true
}

/** After Vite HMR replaces this module, re-link to an already-running Emscripten instance. */
function rehydrateFromWindow(): void {
  const mod = emscriptenGlobal().Module
  if (typeof mod?.ccall === 'function' && mod.calledRun === true && isCppMainFinished()) {
    _module = mod as ArtCadeModule
    _postRunComplete = true
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

/** True when C++ RuntimeEntityGateway is wired (editor_load_project callable). */
export function isEditorEngineWired(): boolean {
  return probeEditorEngineWired().wired
}

/** Diagnostic probe for boot splash when editor API never latches. */
export function probeEditorEngineWired(): { wired: boolean; reason: string } {
  const mod = emscriptenGlobal().Module
  if (!_module?.ccall && typeof mod?.ccall !== 'function') {
    return { wired: false, reason: 'WASM module not loaded' }
  }
  if (!mod?.calledRun) return { wired: false, reason: 'WASM main() not finished' }
  if (!_postRunComplete) {
    return { wired: false, reason: 'WASM main() still starting…' }
  }
  const code = safeCcallNumber('editor_is_engine_wired', [], [])
  if (code === EDITOR_API_CCALL_FAILED) {
    return {
      wired: false,
      reason: peekWasmBridgeLastError() ?? 'editor_is_engine_wired ccall failed',
    }
  }
  if (code === 1) return { wired: true, reason: 'ok' }
  const exitProbe = rawBootCcallNumber('editor_get_main_exit_code')
  const bootFailure = readBootFailureStep()
  if (bootFailure) {
    return { wired: false, reason: `[App] init failed: ${bootFailure}` }
  }
  if (exitProbe === WASM_MAIN_EXIT_PENDING
    || (exitProbe === EDITOR_API_CCALL_FAILED && code === 0)) {
    return { wired: false, reason: 'WASM main() still initializing…' }
  }
  if (exitProbe === null) {
    return {
      wired: false,
      reason: peekWasmBridgeLastError() ?? 'editor_get_main_exit_code unavailable',
    }
  }
  if (exitProbe === 1) {
    return { wired: false, reason: '[App] main() failed during init (no step recorded)' }
  }
  if (exitProbe === 0 && code === 0) {
    return { wired: false, reason: 'C++ gateway cleared after init (module shutdown)' }
  }
  if (!hasWasmExport('editor_get_boot_failure')) {
    return {
      wired: false,
      reason: 'Stale WASM — rebuild runtime-cpp (missing editor_get_boot_failure)',
    }
  }
  return {
    wired: false,
    reason: `C++ gateway not wired (main exit=${exitProbe})`,
  }
}

function hasWasmExport(name: string): boolean {
  if (!_module?.ccall || !_module.calledRun || !_postRunComplete) return false
  try {
    _module.ccall(name, 'string', [], [])
    return true
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return !detail.includes('is not a function') && !detail.includes('was not exported')
  }
}

function readBootFailureStep(): string {
  if (!_module?.ccall || !_module.calledRun || !_postRunComplete) return ''
  try {
    const ptr = _module.ccall('editor_get_boot_failure', 'number', [], []) as number
    if (ptr) return _module.UTF8ToString(ptr).trim()
  } catch {
    // Fall through to string return type.
  }
  const raw = safeCcallString('editor_get_boot_failure', [], [])
  return raw?.trim() ?? ''
}

function wireModulePrintHandlers(
  module: ArtCadeModule,
  onConsoleLine: (message: string, level: string) => void,
): void {
  module.print = (text) => {
    captureBootLine(text, 'info')
    onConsoleLine(text, 'info')
  }
  module.printErr = (text) => {
    captureBootLine(text, 'error')
    onConsoleLine(text, 'error')
  }
}

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
  if (cbs.onEntityTransformPreview) g.onEntityTransformPreview = cbs.onEntityTransformPreview
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

function rejectWasmBoot(err: unknown): void {
  if (_wasmBootRejected || !_wasmBootReject) return
  _wasmBootRejected = true
  const message = err instanceof Error ? err.message : String(err)
  captureBootLine(`[WASM] ${message}`, 'error')
  _wasmBootReject(new Error(message))
  wasmInitPromise = null
  _wasmBootNotify = null
  _wasmBootReject = null
}

function appendModulePostRun(mod: Partial<ArtCadeModule>, fn: () => void): void {
  const prev = mod.postRun
  if (!prev) {
    mod.postRun = [fn]
    return
  }
  if (Array.isArray(prev)) {
    mod.postRun = [...prev, fn]
    return
  }
  mod.postRun = [prev, fn]
}

function notifyWasmBootComplete(module: ArtCadeModule): void {
  const notify = _wasmBootNotify
  if (!notify) return
  _wasmBootNotify = null
  _wasmBootReject = null
  notify(module)
}

function resolveWasmBootTimeoutDetail(): string {
  const mod = emscriptenGlobal().Module
  if (!mod?.calledRun) {
    return 'game.js ran but WASM never reached main() — check game.wasm fetch / console'
  }
  if (_postRunComplete) return 'boot latch internal error (already complete)'
  if (isCppMainFinished()) return 'init finished but boot latch missed'
  return 'main() blocked in C++ init (WebGL/canvas) — check DevTools console'
}

function handleWasmBootTimeout(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
  cancelPoll: () => void,
): void {
  cancelPoll()
  if (!_postRunComplete && isCppMainFinished()) {
    markRuntimeBootComplete(canvas, cbs)
    return
  }
  rejectWasmBoot(new Error(
    `[wasm-bridge] Module not ready after loading game.js — ${resolveWasmBootTimeoutDetail()}`,
  ))
}

function scheduleBootLatchPoll(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
): () => void {
  let frame = 0
  let raf = 0
  const maxFrames = 60 * 35
  const tick = (): void => {
    if (_postRunComplete || _wasmBootRejected) return
    frame++
    if (isCppMainFinished()) {
      markRuntimeBootComplete(canvas, cbs)
      return
    }
    if (frame < maxFrames) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

function markRuntimeBootComplete(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
): void {
  if (_postRunComplete && _ready && _module) {
    queueMicrotask(() => {
      cbs.onReady()
      notifyWasmBootComplete(_module as ArtCadeModule)
    })
    return
  }
  _postRunComplete = true
  _module = emscriptenGlobal().Module as ArtCadeModule
  _ready = true
  _module.canvas = canvas
  wakeRuntimeCanvasGl(canvas)
  wireModulePrintHandlers(_module, cbs.onConsoleLine)
  safeCall('editor_set_mode', null, ['number'], [0])
  queueMicrotask(() => {
    cbs.onReady()
    notifyWasmBootComplete(_module as ArtCadeModule)
  })
}

function ensureModuleHooks(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
): void {
  const g = emscriptenGlobal()
  type ModuleWithAbort = Partial<ArtCadeModule> & { onAbort?: (reason: unknown) => void }
  const mod: ModuleWithAbort = g.Module ?? {}
  g.Module = mod

  mod.canvas = canvas
  const cacheBust = cacheQuery()
  mod.locateFile = (path: string) => `${runtimeAssetPath(path)}${cacheBust}`

  const prevOnRuntimeInitialized = mod.onRuntimeInitialized
  mod.onRuntimeInitialized = function onRuntimeInitialized(this: ArtCadeModule) {
    if (typeof prevOnRuntimeInitialized === 'function') {
      prevOnRuntimeInitialized.call(this)
    }
    _module = g.Module as ArtCadeModule
    wireModulePrintHandlers(_module, cbs.onConsoleLine)
    // doRun() continues with callMain() + postRun() after this callback returns.
    queueMicrotask(() => {
      if (isCppMainFinished() && !_postRunComplete) {
        markRuntimeBootComplete(canvas, cbs)
      }
    })
  }

  appendModulePostRun(mod, () => {
    markRuntimeBootComplete(canvas, cbs)
  })

  const prevOnAbort = mod.onAbort
  mod.onAbort = (reason: unknown) => {
    prevOnAbort?.(reason)
    rejectWasmBoot(reason ?? new Error('Emscripten aborted WASM startup'))
  }

  if (typeof mod.ccall === 'function' && mod.calledRun === true && isCppMainFinished()) {
    markRuntimeBootComplete(canvas, cbs)
  }
}

function waitForRuntimeInitialization(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
  _timeoutMessage: string,
): Promise<ArtCadeModule> {
  return new Promise((resolve, reject) => {
    _wasmBootRejected = false
    _wasmBootNotify = (module) => {
      globalThis.clearTimeout(timeoutId)
      cancelPoll()
      wasmInitPromise = null
      resolve(module)
    }
    _wasmBootReject = reject

    const cancelPoll = scheduleBootLatchPoll(canvas, cbs)
    const timeoutId = globalThis.setTimeout(() => {
      handleWasmBootTimeout(canvas, cbs, cancelPoll)
    }, WASM_BOOT_TIMEOUT_MS)

    ensureModuleHooks(canvas, cbs)
  })
}

function adoptExistingRuntime(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
): ArtCadeModule {
  const mod = emscriptenGlobal().Module as ArtCadeModule
  markRuntimeBootComplete(canvas, cbs)
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

function moduleHeapF32(mod: ArtCadeModule): Float32Array | null {
  const heapU8 = mod.HEAPU8
  if (!heapU8?.buffer) {
    _lastBridgeError = 'WASM runtime memory view HEAPU8 is unavailable.'
    return null
  }
  if (mod.HEAPF32?.buffer === heapU8.buffer) {
    return mod.HEAPF32
  }
  return new Float32Array(heapU8.buffer)
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
  onEntityTransformPreview: (entityId: number, x: number, y: number,
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

  // PreviewPanel rebinds the singleton canvas after boot. Resetting boot
  // dimensions here desyncs Raylib's framebuffer from the viewport host and
  // leaves OFFSCREEN_FRAMEBUFFER compositing only the clear color (black view).
  if (_ready && _module && _postRunComplete) {
    _module.canvas = canvas
    wakeRuntimeCanvasGl(canvas)
    queueMicrotask(() => cbs.onReady())
    return Promise.resolve(_module)
  }

  if (!wasmScriptInDom() && !isWasmModuleReady()) {
    ensureRuntimeCanvasForWasmBoot(canvas)
    _ready = false
    _postRunComplete = false
    _module = null
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
        wakeRuntimeCanvasGl(canvas)
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
      wakeRuntimeCanvasGl(canvas)
      bindWindowCallbacks(cbs)
      queueMicrotask(() => cbs.onReady())
      return mod
    })
  }

  wasmInitPromise = new Promise<ArtCadeModule>((resolve, reject) => {
    _wasmBootRejected = false
    _wasmBootNotify = (module) => {
      globalThis.clearTimeout(timeoutId)
      cancelPoll()
      wasmInitPromise = null
      resolve(module)
    }
    _wasmBootReject = reject

    const cancelPoll = scheduleBootLatchPoll(canvas, cbs)
    const timeoutId = globalThis.setTimeout(() => {
      handleWasmBootTimeout(canvas, cbs, cancelPoll)
    }, WASM_BOOT_TIMEOUT_MS)

    ensureModuleHooks(canvas, cbs)

    const script   = document.createElement('script')
    script.id      = WASM_SCRIPT_ID
    script.src     = `${gameSrc}${cacheQuery()}`
    script.async   = true

    script.onload = () => {
      console.log('[wasm-bridge] game.js loaded.')
      const mod = emscriptenGlobal().Module as ArtCadeModule & {
        addOnPostRun?: (fn: () => void) => void
      }
      if (typeof mod?.addOnPostRun === 'function') {
        mod.addOnPostRun(() => {
          if (!_postRunComplete) markRuntimeBootComplete(canvas, cbs)
        })
      }
      if (isCppMainFinished() && !_postRunComplete) {
        markRuntimeBootComplete(canvas, cbs)
      }
    }

    script.onerror = () => {
      globalThis.clearTimeout(timeoutId)
      cancelPoll()
      wasmInitPromise = null
      _wasmBootNotify = null
      _wasmBootReject = null
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
  if (!_module?.ccall || !_module.calledRun || !_postRunComplete) {
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
  if (!_module?.ccall || !_module.calledRun || !_postRunComplete) {
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
  if (!_module?.ccall || !_module.calledRun || !_postRunComplete) return null
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

export function editorLoadProject(projectJson: string): number {
  if (!_module) {
    _lastBridgeError = 'WASM module is not loaded.'
    return EDITOR_API_CCALL_FAILED
  }
  const ptr = marshalString(projectJson)
  try {
    const code = safeCcallNumber('editor_load_project', ['number'], [ptr])
    if (code === EditorApiResult.Ok) {
      _onTextureCacheEvicted?.()
    }
    return code
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
    const ok = safeCcallNumber(
      'editor_register_image',
      ['number', 'number', 'number', 'number'],
      [pathPtr, dataPtr, bytes.length, extPtr],
    )
    return ok === 1
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

/** Frames the selected entity (F) via native ViewController policy. */
export function editorFrameSelection(
  posX: number, posY: number, scaleX: number, scaleY: number,
): void {
  safeCall(
    'editor_frame_selection', null,
    ['number', 'number', 'number', 'number'],
    [posX, posY, scaleX, scaleY],
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
    if (!safeCall('editor_get_editor_view', null, ['number', 'number', 'number'], [xPtr, yPtr, zPtr])) {
      return { x: 0, y: 0, zoomDevice: 1 }
    }
    const heapF32 = moduleHeapF32(mod)
    if (!heapF32) return { x: 0, y: 0, zoomDevice: 1 }
    return {
      x: heapF32[xPtr >> 2],
      y: heapF32[yPtr >> 2],
      zoomDevice: heapF32[zPtr >> 2],
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
  const revision = safeCcallNumber('editor_get_presentation_revision', [], [])
  return revision > 0 ? revision : 0
}

/** Committed scene revision from the last SceneFrameSnapshot (PR6). */
export function editorGetSceneRevision(): number {
  const revision = safeCcallNumber('editor_get_scene_revision', [], [])
  return revision > 0 ? revision : 0
}

/**
 * Tags the next Emscripten canvas pointer sample with a presentation revision
 * captured by the browser at event time.
 */
export function editorSetPointerPresentationRevision(revision: bigint): void {
  if (revision <= 0n) return
  safeCall(
    'editor_set_pointer_presentation_revision', null,
    ['number'],
    [Number(revision)],
  )
}

/** Reads the committed presentation snapshot ABI from WASM (Phase 5). */
export function editorReadPresentationSnapshot(): PresentationSnapshot | null {
  const mod = _module
  if (!mod) return null
  const ptr = safeCcallNumber('editor_get_presentation_snapshot', [], [])
  if (ptr <= 0) return null
  try {
    return parsePresentationSnapshotWasm(mod.HEAPU8, ptr)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    _lastBridgeError = `Presentation snapshot parse failed: ${detail}`
    console.warn('[wasm-bridge] presentation snapshot parse failed:', err)
    return null
  }
}

/** Surface (framebuffer) → world via committed presentation snapshot. */
export function editorSurfaceToWorld(
  surfaceX: number,
  surfaceY: number,
  presentationRevision?: bigint,
): { x: number; y: number } {
  const mod = _module
  if (!mod) return { x: surfaceX, y: surfaceY }
  const wxPtr = mod._malloc(4)
  const wyPtr = mod._malloc(4)
  try {
    const revision = presentationRevision && presentationRevision > 0n
      ? Number(presentationRevision)
      : 0
    let ok = false
    if (revision > 0) {
      ok = safeCall(
        'editor_surface_to_world_at_revision', null,
        ['number', 'number', 'number', 'number', 'number'],
        [surfaceX, surfaceY, revision, wxPtr, wyPtr],
      )
    }
    if (!ok) {
      ok = safeCall(
        'editor_surface_to_world', null,
        ['number', 'number', 'number', 'number'],
        [surfaceX, surfaceY, wxPtr, wyPtr],
      )
    }
    if (!ok) return { x: surfaceX, y: surfaceY }
    const heapF32 = moduleHeapF32(mod)
    if (!heapF32) return { x: surfaceX, y: surfaceY }
    return {
      x: heapF32[wxPtr >> 2],
      y: heapF32[wyPtr >> 2],
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
  safeCall('editor_set_play_presentation', null, ['number'], [PRESENTATION_MODE_ABI[mode]])
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

export function editorBeginAuthoringSyncBatch(): void {
  safeCall('editor_begin_authoring_sync_batch', null, [], [])
}

export function editorEndAuthoringSyncBatch(): void {
  safeCall('editor_end_authoring_sync_batch', null, [], [])
}

// All cross-channel sync orchestration now lives in
// `utils/runtime-sync-service.ts`. The thin per-channel wrappers above remain
// here as the low-level bridge to the WASM exports.
