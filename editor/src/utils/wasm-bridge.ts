import { runtimeAssetPath } from './runtime-path'

// ---------------------------------------------------------------------------
// wasm-bridge.ts — React ↔ C++ WASM bridge
//
// Architecture (Guida_Architettura_e_SmokeTest_ArtCade):
//
//   C++ → React : EM_ASM calls window.on* globals
//                 (set here BEFORE game.js loads so the callback is ready)
//
//   React → C++ : Module.ccall('function_name', returnType, argTypes, args)
//                 Calls EMSCRIPTEN_KEEPALIVE exported C functions.
//
// WASM singleton: game.js (Emscripten) must be injected ONCE per window.
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
    Module: Partial<ArtCadeModule>

    onObjectUpdated?:             (x: number, y: number) => void
    onEntitySelected?:            (entityId: number) => void
    onEntityTransformChanged?:    (entityId: number, x: number, y: number,
                                   rot: number, sx: number, sy: number) => void
    onConsoleLine?:               (message: string, level: string) => void
    onTilemapPainted?:            (col: number, row: number, tileId: number) => void
  }
}

// ---------------------------------------------------------------------------
// Internal state — WASM singleton
// ---------------------------------------------------------------------------

const WASM_SCRIPT_ID = 'artcade-raylib-wasm-script'

let _module: ArtCadeModule | null = null
let _ready  = false
let wasmInitPromise: Promise<ArtCadeModule> | null = null

/**
 * True only after Emscripten finished startup (onRuntimeInitialized + main).
 * `ccall` exists earlier — calling exports before `calledRun` throws "func is not a function".
 */
function isWasmModuleReady(): boolean {
  const mod = window.Module as Partial<ArtCadeModule> | undefined
  return typeof mod?.ccall === 'function' && mod.calledRun === true
}

/** After Vite HMR replaces this module, re-link to an already-running Emscripten instance. */
function rehydrateFromWindow(): void {
  if (isWasmModuleReady()) {
    _module = window.Module as ArtCadeModule
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

function bindWindowCallbacks(cbs: WasmCallbacks): void {
  window.onEntitySelected         = cbs.onEntitySelected
  window.onEntityTransformChanged = cbs.onEntityTransformChanged
  window.onConsoleLine            = cbs.onConsoleLine
  window.onTilemapPainted         = cbs.onTilemapPainted
  window.onObjectUpdated = (x, y) =>
    cbs.onEntityTransformChanged(0, x, y, 0, 1, 1)
}

function attachModuleHooks(
  canvas: HTMLCanvasElement,
  cbs: WasmCallbacks,
): void {
  const cacheBust = cacheQuery()
  const existing = window.Module ?? {}
  const prevOnRuntimeInitialized = existing.onRuntimeInitialized

  window.Module = {
    ...existing,
    canvas,
    locateFile: (path: string, _prefix: string) => `${runtimeAssetPath(path)}${cacheBust}`,

    onRuntimeInitialized() {
      if (typeof prevOnRuntimeInitialized === 'function') {
        prevOnRuntimeInitialized.call(window.Module)
      }
      _module = window.Module as ArtCadeModule
      _ready  = true

      _module.print    = (t) => cbs.onConsoleLine(t, 'info')
      _module.printErr = (t) => cbs.onConsoleLine(t, 'error')

      safeCall('editor_set_mode', null, ['number'], [0])
      cbs.onReady()
    },
  }

  // Runtime may already be up (HMR / StrictMode remount / script tag left in DOM).
  if (isWasmModuleReady()) {
    _module = window.Module as ArtCadeModule
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
  const mod = window.Module as ArtCadeModule
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
}

/**
 * Load game.js once per window. Safe under React StrictMode and Vite HMR.
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

    script.onerror = (err) => {
      wasmInitPromise = null
      script.remove()
      console.error(`[wasm-bridge] Failed to load WASM runtime from "${gameSrc}"`, err)
      reject(err)
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
): void {
  if (!_module?.ccall || !_module.calledRun) return
  try {
    _module.ccall(name, returnType, argTypes, args)
  } catch (err) {
    console.warn(`[wasm-bridge] ccall('${name}') failed:`, err)
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

export function editorReloadScript(luaSource: string): boolean {
  if (!_module) return false
  const ptr = marshalString(luaSource)
  try {
    safeCall('editor_reload_script', null, ['number'], [ptr])
    return true
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
    safeCall(
      'editor_register_image',
      null,
      ['number', 'number', 'number', 'number'],
      [pathPtr, dataPtr, bytes.length, extPtr],
    )
    return true
  } finally {
    _module._free(dataPtr)
    _module._free(extPtr)
    _module._free(pathPtr)
  }
}

export function editorSetTilePaintMode(enabled: boolean): void {
  safeCall('editor_set_tile_paint_mode', null, ['number'], [enabled ? 1 : 0])
}

export function editorSetSelectedTile(tileId: number): void {
  safeCall('editor_set_selected_tile', null, ['number'], [tileId])
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

export interface RuntimeSyncState {
  projectJson?: string
  mode?: 0 | 1
  selectedEntityId?: number | null
}

export function syncEditorRuntimeState(state: RuntimeSyncState): void {
  if (state.projectJson != null) editorLoadProject(state.projectJson)
  if (state.mode != null) editorSetMode(state.mode)
  if (state.selectedEntityId !== undefined) {
    if (state.selectedEntityId == null) editorDeselect()
    else editorSelectEntity(state.selectedEntityId)
  }
}
