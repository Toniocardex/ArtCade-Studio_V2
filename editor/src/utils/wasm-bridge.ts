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
// The functions below match the editor-api.h / smoke test implementations.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Emscripten Module type
// ---------------------------------------------------------------------------

export interface ArtCadeModule {
  // Called once when the WASM binary is fully initialised
  onRuntimeInitialized?: () => void
  calledRun: boolean
  canvas: HTMLCanvasElement

  // Resolves asset paths (game.data, game.wasm) — called by Emscripten before
  // the runtime starts.  We override it in window.Module to force /runtime/<path>
  // regardless of the scriptDirectory (which is "" when game.js is async).
  locateFile?: (path: string, prefix: string) => string

  // Emscripten runtime methods (exported via EXPORTED_RUNTIME_METHODS)
  ccall(name: string, returnType: string | null, argTypes: string[], args: unknown[]): unknown
  cwrap(name: string, returnType: string | null, argTypes: string[]): (...args: unknown[]) => unknown
  UTF8ToString(ptr: number): string
  lengthBytesUTF8(str: string): number
  stringToUTF8(str: string, ptr: number, maxBytes: number): void
  _malloc(size: number): number
  _free(ptr: number): void

  // Console passthrough
  print?:    (text: string) => void
  printErr?: (text: string) => void
}

// Extend Window with the globals the C++ bridge sets via EM_ASM
declare global {
  interface Window {
    Module: Partial<ArtCadeModule>

    // C++ → React callbacks — set BEFORE game.js loads
    onObjectUpdated?:             (x: number, y: number) => void          // ST-3
    onEntitySelected?:            (entityId: number) => void
    onEntityTransformChanged?:    (entityId: number, x: number, y: number,
                                   rot: number, sx: number, sy: number) => void
    onConsoleLine?:               (message: string, level: string) => void
  }
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _module:  ArtCadeModule | null = null
let _ready  = false

export function getModule(): ArtCadeModule | null { return _module }
export function isReady():   boolean              { return _ready  }

// ---------------------------------------------------------------------------
// String marshalling (for editor_load_project)
// ---------------------------------------------------------------------------

export function marshalString(str: string): number {
  if (!_module) throw new Error('[wasm-bridge] Module not loaded')
  const bytes = _module.lengthBytesUTF8(str) + 1
  const ptr   = _module._malloc(bytes)
  _module.stringToUTF8(str, ptr, bytes)
  return ptr
}

// ---------------------------------------------------------------------------
// loadWasmRuntime
// ---------------------------------------------------------------------------

export interface WasmCallbacks {
  onReady:                  () => void
  onEntitySelected:         (entityId: number) => void
  onEntityTransformChanged: (entityId: number, x: number, y: number,
                             rot: number, sx: number, sy: number) => void
  onConsoleLine:            (message: string, level: string) => void
}

/**
 * Dynamically load game.js (Emscripten entry point) into this page.
 *
 * Key ordering requirement (architecture doc):
 *   1. Set window.on* globals FIRST  ← C++ EM_ASM will call these
 *   2. Configure window.Module with canvas
 *   3. Inject game.js script tag     ← reads window.Module, starts WASM
 *
 * @param canvas   The <canvas> element Emscripten renders into.
 * @param gameSrc  Path/URL to game.js (e.g. "/runtime/game.js").
 * @param cbs      React callbacks for C++→React events.
 */
export function loadWasmRuntime(
  canvas:  HTMLCanvasElement,
  gameSrc: string,
  cbs:     WasmCallbacks,
): void {
  if (_module) return  // already loaded

  // Step 1 ── Set window.on* globals so EM_ASM can find them immediately
  window.onEntitySelected         = cbs.onEntitySelected
  window.onEntityTransformChanged = cbs.onEntityTransformChanged
  window.onConsoleLine            = cbs.onConsoleLine
  // onObjectUpdated used by smoke tests (ST-3/ST-4)
  window.onObjectUpdated = (x, y) =>
    cbs.onEntityTransformChanged(0, x, y, 0, 1, 1)

  // Step 2 ── Configure Module with canvas and lifecycle hook
  const _cacheBust = Date.now()
  window.Module = {
    canvas,

    // Force fresh fetch of game.wasm and game.data every time (no browser cache).
    // We ALWAYS use /runtime/<path> regardless of `prefix` because:
    //   1. game.js is an async script → document.currentScript is null → scriptDirectory=""
    //   2. Emscripten passes "" as prefix for game.data (from the preload IIFE)
    // Both cases would produce a path-relative URL that resolves to the wrong location.
    locateFile: (path: string, _prefix: string) => `/runtime/${path}?v=${_cacheBust}`,

    onRuntimeInitialized() {
      _module = window.Module as ArtCadeModule
      _ready  = true

      // Forward engine stdout → React Console
      _module.print    = (t) => cbs.onConsoleLine(t, 'info')
      _module.printErr = (t) => cbs.onConsoleLine(t, 'error')

      // Enter editor mode by default
      safeCall('editor_set_mode', null, ['number'], [0])
      cbs.onReady()
    },
  }

  // Step 3 ── Inject game.js (reads window.Module above)
  // Cache-bust so the browser always fetches the latest build
  const script   = document.createElement('script')
  script.src     = `${gameSrc}?v=${Date.now()}`
  script.async   = true
  script.onerror = () =>
    console.error(`[wasm-bridge] Failed to load WASM runtime from "${gameSrc}"`)
  document.body.appendChild(script)
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
  if (!_module?.ccall) return
  _module.ccall(name, returnType, argTypes, args)
}

// ---------------------------------------------------------------------------
// React → C++ command wrappers
// (use Module.ccall — the pattern documented in Smoke Test 4)
// ---------------------------------------------------------------------------

/** Switch between editor mode (0) and play/game mode (1). */
export function editorSetMode(mode: 0 | 1): void {
  safeCall('editor_set_mode', null, ['number'], [mode])
}

/** Highlight an entity in the viewport (shows gizmo). */
export function editorSelectEntity(entityId: number): void {
  safeCall('editor_select_entity', null, ['number'], [entityId])
}

/** Clear viewport selection. */
export function editorDeselect(): void {
  safeCall('editor_deselect', null, [], [])
}

/**
 * Hot-reload the full project JSON into the C++ runtime.
 * Marshals the string through the Emscripten heap.
 */
export function editorLoadProject(projectJson: string): void {
  if (!_module) return
  const ptr = marshalString(projectJson)
  try {
    safeCall('editor_load_project', null, ['number'], [ptr])
  } finally {
    _module._free(ptr)
  }
}

/**
 * Hot-reload compiled Logic Board Lua into the running C++ VM.
 * Marshals the source through the Emscripten heap; the runtime executes it
 * via LuaHost::loadLuaSource(), redefining the global tick().
 * Returns false if the WASM module is not loaded yet.
 */
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

/** Push an Inspector transform change into the C++ scene. */
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

/** Push editor state changes into the C++ runtime through the stable bridge API. */
export function syncEditorRuntimeState(state: RuntimeSyncState): void {
  if (state.projectJson != null) editorLoadProject(state.projectJson)
  if (state.mode != null) editorSetMode(state.mode)
  if (state.selectedEntityId !== undefined) {
    if (state.selectedEntityId == null) editorDeselect()
    else editorSelectEntity(state.selectedEntityId)
  }
}
