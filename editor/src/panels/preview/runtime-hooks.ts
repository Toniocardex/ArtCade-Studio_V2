// ---------------------------------------------------------------------------
// preview/runtime-hooks — encapsulate the React ↔ C++ runtime sync layer
// ---------------------------------------------------------------------------
//
// `PreviewPanel` used to own every aspect of the runtime bridge: WASM lifecycle,
// canvas rebind, project re-sync via fingerprint, asset upload. As more
// channels were added the file grew past 500 lines and small changes risked
// breaking the callback contract (P1/P2 in TECHNICAL_DEBT_REVIEW.md).
//
// These hooks isolate each concern. The panel still owns presentation, the
// tool palette, and React state; everything below the “runtime” surface lives
// here.

import {
  useCallback, useEffect, useRef,
  type Dispatch, type MutableRefObject, type RefObject,
} from 'react'
import {
  loadWasmRuntime, isReady,
  editorSetActiveTileLayer,
  type WasmCallbacks,
} from '../../utils/wasm-bridge'
import { WASM_RUNTIME_SRC } from '../../utils/runtime-path'
import { runtimeSync, type EditorTool } from '../../utils/runtime-sync-service'
import {
  getPreviewLuaSyncKey,
  logLogicBoardCompileFailure,
  resolvePreviewMainLuaWithStatus,
} from '../../utils/preview-restore'
import {
  scheduleWasmUiUpdate,
  scheduleWasmUiUpdateWhen,
} from '../../utils/wasm-ui-scheduler'
import { setRuntimeProfileSample } from '../../utils/runtime-profile-buffer'
import type { ConsoleEntry, ProjectDoc, ScriptFile } from '../../types'
import type { Action as EditorAction } from '../../store/editor-store'

export interface MakeLogEntry { (message: string, level: string): ConsoleEntry }

// ---------------------------------------------------------------------------
// buildRuntimeCallbacks — single source of truth for the C++→React contract
// (all deferred UI work goes through utils/wasm-ui-scheduler)
// ---------------------------------------------------------------------------

export interface RuntimeCallbackDeps {
  cancelled: () => boolean
  dispatch: Dispatch<EditorAction>
  handleRuntimeTransform: (
    entityId: number, x: number, y: number,
    rotation: number, scaleX: number, scaleY: number,
  ) => void
  sceneIdRef: MutableRefObject<string>
  syncRuntimeUiFlags: () => void
  makeLogEntry: MakeLogEntry
  /** Latest project payload for boot sync when onReady fires before React listeners attach. */
  bootSyncRef: MutableRefObject<{
    project: ProjectDoc | null
    projectPath: string | null
    openScripts: ScriptFile[]
    dialogs: Record<string, import('../../utils/dialog/dialog-script').DialogScript>
    selectionSceneId: string | null
    isPlaying: boolean
  }>
}

export function buildRuntimeCallbacks(deps: RuntimeCallbackDeps): WasmCallbacks {
  const {
    cancelled, dispatch,
    handleRuntimeTransform, sceneIdRef, syncRuntimeUiFlags, makeLogEntry, bootSyncRef,
  } = deps
  return {
    onReady: () => {
      syncRuntimeUiFlags()
      // Broadcast readiness so non-PreviewPanel consumers (LogicBoardPanel
      // Apply, Script editor Hot-Reload, etc.) can transition out of their
      // "runtime still loading" state without waiting for a re-render of
      // the preview panel.
      runtimeSync.notifyReadyChanged()
      // Engine (Editor API) readiness is NOT signalled here: at
      // onRuntimeInitialized the bridge ccalls still return NotWired. EditorAPI::init
      // emits "[EditorAPI] Bridge initialised" once the ccalls are live, and
      // onConsoleLine turns that into notifyEngineReady() — the one authoritative
      // signal. Flagging engine-ready here triggered a project re-sync that called
      // editorReloadScript before it was wired (NotWired flood → render loop).
      const boot = bootSyncRef.current
      if (boot.project != null) {
        scheduleWasmUiUpdateWhen(cancelled, () => {
          performRuntimeProjectSync({
            ...boot,
            wasmReady: isReady(),
            engineReady: runtimeSync.isEngineReady(),
            dispatch,
            makeLogEntry,
          })
        }, { urgent: true })
      }
      scheduleWasmUiUpdateWhen(cancelled, () => {
        dispatch({
          type: 'LOG',
          entry: makeLogEntry('[WASM] Runtime initialised — editor mode active.', 'info'),
        })
      })
    },
    onEntitySelected: (entityId: number) => {
      scheduleWasmUiUpdateWhen(cancelled, () => {
        dispatch({ type: 'SELECT_ENTITY', entityId })
      }, { urgent: true })
    },
    onEntityDuplicateRequested: (entityId: number, x: number, y: number) => {
      scheduleWasmUiUpdateWhen(cancelled, () => {
        dispatch({
          type: 'INSTANCE_DUPLICATE',
          instanceId: entityId,
          sceneId: sceneIdRef.current,
          position: { x, y },
        })
      }, { urgent: true })
    },
    onEntityTransformChanged: (
      entityId: number, x: number, y: number,
      rotation: number, scaleX: number, scaleY: number,
    ) => {
      scheduleWasmUiUpdateWhen(cancelled, () => {
        handleRuntimeTransform(entityId, x, y, rotation, scaleX, scaleY)
      }, { urgent: true })
    },
    onConsoleLine: (message: string, level: string) => {
      // Authoritative engine-ready signal — register it BEFORE the cancelled()
      // guard so a stale/cancelled callbacks instance (StrictMode / dispatch
      // identity churn) can never drop boot's transition to engine-ready.
      // notifyEngineReady is edge-triggered, so a repeat is a harmless no-op.
      if (message.includes('[EditorAPI] Bridge initialised')) {
        runtimeSync.notifyEngineReady()
        // Boot sync must not run inside Module.print — reentrant editor_load_project
        // during the print callback caused Maximum update depth (React #185).
        const boot = bootSyncRef.current
        if (boot.project != null) {
          scheduleWasmUiUpdate(() => {
            performRuntimeProjectSync({
              project: boot.project,
              projectPath: boot.projectPath,
              openScripts: boot.openScripts,
              dialogs: boot.dialogs,
              selectionSceneId: boot.selectionSceneId,
              isPlaying: boot.isPlaying,
              wasmReady: isReady(),
              engineReady: runtimeSync.isEngineReady(),
              dispatch,
              makeLogEntry,
            })
          }, { urgent: true })
        }
      }
      // EditorAPI errors must reach the console even if an older lifecycle
      // hook marked itself cancelled (e.g. StrictMode / dispatch identity churn).
      const forceLog =
        level === 'error' ||
        (level === 'warn' && message.includes('[EditorAPI]'))
      if (cancelled() && !forceLog) return
      const entry = makeLogEntry(message, level)
      scheduleWasmUiUpdate(() => {
        if (cancelled() && !forceLog) return
        dispatch({ type: 'LOG', entry })
      }, { urgent: forceLog })
    },
    onRuntimeProfile: (
      fps: number,
      luaMs: number,
      physicsMs: number,
      renderMs: number,
      entityCount: number,
      physicsBodies: number,
    ) => {
      setRuntimeProfileSample({
        fps, luaMs, physicsMs, renderMs, entityCount, physicsBodies,
      })
    },
    onEditorCursorWorld: (x: number, y: number) => {
      scheduleWasmUiUpdateWhen(cancelled, () => {
        dispatch({ type: 'SET_CURSOR', x, y })
      })
    },
  }
}

// ---------------------------------------------------------------------------
// useWasmRuntimeLifecycle — mount the runtime + handle canvas view rebind
// ---------------------------------------------------------------------------

interface LifecycleOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** Set after layout effect adopts the singleton runtime canvas. */
  canvasReady: boolean
  mode: string
  dispatch: Dispatch<EditorAction>
  sceneIdRef: MutableRefObject<string>
  syncRuntimeUiFlags: () => void
  handleRuntimeTransform: (
    entityId: number, x: number, y: number,
    rotation: number, scaleX: number, scaleY: number,
  ) => void
  makeLogEntry: MakeLogEntry
  bootSyncRef: RuntimeCallbackDeps['bootSyncRef']
}

export function useWasmRuntimeLifecycle(opts: LifecycleOptions): void {
  const {
    canvasRef, canvasReady, mode, dispatch,
    sceneIdRef, syncRuntimeUiFlags, handleRuntimeTransform, makeLogEntry, bootSyncRef,
  } = opts

  // ── Mount (once per dispatch identity) ────────────────────────────────────
  useEffect(() => {
    if (!canvasReady) return
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => cancelled,
      dispatch,
      handleRuntimeTransform, sceneIdRef, syncRuntimeUiFlags,
      makeLogEntry, bootSyncRef,
    })

    if (isReady()) {
      callbacks.onReady()
      void loadWasmRuntime(canvas, WASM_RUNTIME_SRC, callbacks)
      return () => { cancelled = true }
    }

    void loadWasmRuntime(canvas, WASM_RUNTIME_SRC, callbacks).catch((err) => {
      if (!cancelled) {
        console.error('[PreviewPanel] WASM init failed:', err)
        dispatch({
          type: 'LOG',
          entry: makeLogEntry(`[WASM] Init failed: ${String(err)}`, 'error'),
        })
      }
    })

    return () => { cancelled = true }
    // Intentionally keyed on `dispatch` only: remount WASM when EditorProvider
    // resets (boot session). Canvas/mode/callbacks are stable refs — re-running
    // on them would double-init the runtime (see docs/TECHNICAL_DEBT_REVIEW.md P1/P2).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, canvasReady])

  // ── Rebind canvas when returning to Canvas view ──────────────────────────
  useEffect(() => {
    if (mode !== 'canvas') return
    const canvas = canvasRef.current
    if (!canvas || !isReady()) return
    syncRuntimeUiFlags()
    // Rebind uses cancelled: () => false — this effect only swaps the canvas
    // target; lifecycle teardown remains on the mount effect above.
    void loadWasmRuntime(canvas, WASM_RUNTIME_SRC, buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform, sceneIdRef, syncRuntimeUiFlags,
      makeLogEntry, bootSyncRef,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dispatch])
}

// ---------------------------------------------------------------------------
// useRuntimeProjectSync — push ProjectDoc into C++ on runtime-affecting change
// ---------------------------------------------------------------------------

export function shouldSyncProjectToRuntime(opts: {
  wasmReady: boolean
  engineReady: boolean
  project: ProjectDoc | null
  isPlaying: boolean
}): boolean {
  return opts.wasmReady && opts.engineReady && opts.project != null && !opts.isPlaying
}

interface ProjectSyncOptions {
  project: ProjectDoc | null
  projectPath: string | null
  openScripts: ScriptFile[]
  dialogs: Record<string, import('../../utils/dialog/dialog-script').DialogScript>
  selectionSceneId: string | null
  wasmReady: boolean
  engineReady: boolean
  isPlaying: boolean
  dispatch: Dispatch<EditorAction>
  makeLogEntry: MakeLogEntry
}

/** Imperative project → WASM sync (testable; used by useRuntimeProjectSync). */
export function performRuntimeProjectSync(opts: ProjectSyncOptions): void {
  const {
    project, projectPath, openScripts, dialogs, selectionSceneId,
    wasmReady, engineReady, isPlaying,
    dispatch, makeLogEntry,
  } = opts
  if (!shouldSyncProjectToRuntime({ wasmReady, engineReady, project, isPlaying })) {
    return
  }
  if (runtimeSync.isTransitioning()) {
    return
  }
  const runtimeSceneId = selectionSceneId ?? project!.activeSceneId
  const { lua: mainLua, compileError } = resolvePreviewMainLuaWithStatus({
    project: project!,
    openScripts,
    projectPath,
  })
  logLogicBoardCompileFailure(dispatch, compileError, makeLogEntry)
  runtimeSync.syncProject(project!, runtimeSceneId, projectPath, { mainLua, dialogs })
}

export function useRuntimeProjectSync(opts: ProjectSyncOptions): void {
  const {
    project, projectPath, openScripts, dialogs, selectionSceneId,
    wasmReady, engineReady, isPlaying,
  } = opts
  const previewLuaSyncKey =
    project != null
      ? getPreviewLuaSyncKey({ project, openScripts, projectPath })
      : ''

  // Latest sync inputs, read by the stable `run`. Keeping the closure stable is
  // what lets the readiness subscription mount once (see below) instead of
  // re-registering every render — the churn that re-entered syncProject on each
  // subscribe (immediate callback) and drove the boot render loop.
  const optsRef = useRef(opts)
  optsRef.current = opts

  const run = useCallback(() => {
    const o = optsRef.current
    performRuntimeProjectSync({
      project: o.project,
      projectPath: o.projectPath,
      openScripts: o.openScripts,
      dialogs: o.dialogs,
      selectionSceneId: o.selectionSceneId,
      wasmReady: isReady(),
      engineReady: runtimeSync.isEngineReady(),
      isPlaying: o.isPlaying,
      dispatch: o.dispatch,
      makeLogEntry: o.makeLogEntry,
    })
  }, [])

  // Re-sync when project content that reaches the runtime changes.
  useEffect(() => {
    run()
  }, [
    run,
    previewLuaSyncKey,
    dialogs,
    selectionSceneId,
    isPlaying,
    project,
    projectPath,
    openScripts,
    wasmReady,
    engineReady,
  ])

  // Subscribe to readiness flips ONCE (run is stable). onReadyChange/
  // onEngineReadyChange invoke the callback immediately on subscribe, so a
  // per-render re-subscribe previously fired syncProject on every render.
  useEffect(() => {
    const unsubWasm = runtimeSync.onReadyChange(run)
    const unsubEngine = runtimeSync.onEngineReadyChange(run)
    return () => {
      unsubWasm()
      unsubEngine()
    }
  }, [run])
}

// ---------------------------------------------------------------------------
// useRuntimeEditorSync — drive every per-frame editor channel via the service
// ---------------------------------------------------------------------------

interface EditorSyncOptions {
  wasmReady: boolean
  engineReady: boolean
  isPlaying: boolean
  selectedEntityId: number | null
  selectedEntityIds: readonly number[]
  tool: EditorTool
  activeTileLayer: string
  guides: boolean
  gridSize: number
  snapToGrid: boolean
}

export function useRuntimeEditorSync(opts: EditorSyncOptions): void {
  const {
    wasmReady, engineReady,
    isPlaying, selectedEntityId, selectedEntityIds, tool, activeTileLayer,
    guides, gridSize, snapToGrid,
  } = opts

  useEffect(() => {
    if (!wasmReady || !engineReady) return
    runtimeSync.syncPlayMode(isPlaying)
  }, [isPlaying, wasmReady, engineReady])

  useEffect(() => {
    if (!wasmReady || !engineReady) return
    runtimeSync.syncSelection(selectedEntityId, selectedEntityIds)
  }, [selectedEntityId, selectedEntityIds, wasmReady, engineReady])

  useEffect(() => {
    if (!wasmReady || !engineReady) return
    runtimeSync.syncEditorTool(tool)
  }, [tool, wasmReady, engineReady])

  useEffect(() => {
    if (!wasmReady || !engineReady) return
    editorSetActiveTileLayer(activeTileLayer)
  }, [activeTileLayer, wasmReady, engineReady])

  useEffect(() => {
    if (!wasmReady || !engineReady) return
    runtimeSync.syncEditorChrome({ guides, gridSize, snapToGrid, isPlaying })
  }, [guides, gridSize, snapToGrid, isPlaying, wasmReady, engineReady])
}

// ---------------------------------------------------------------------------
// useRuntimeAssetUpload — scene-scoped textures into the C++ cache (Phase A/B)
// ---------------------------------------------------------------------------

interface AssetUploadOptions {
  project: ProjectDoc | null
  projectPath: string | null
  activeSceneId: string | null
  wasmReady: boolean
  engineReady: boolean
}

export function useRuntimeAssetUpload(opts: AssetUploadOptions): void {
  const {
    project, projectPath, activeSceneId, wasmReady, engineReady,
  } = opts
  useEffect(() => {
    if (!wasmReady || !engineReady || !project || !activeSceneId) return
    runtimeSync.syncProjectAssets(project, activeSceneId, projectPath)
  }, [project, projectPath, activeSceneId, wasmReady, engineReady])
}
