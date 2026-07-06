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
  useCallback, useEffect, useLayoutEffect, useRef,
  type Dispatch, type MutableRefObject, type RefObject,
} from 'react'
import {
  loadWasmRuntime, isReady, isEditorEngineWired,
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
import { debugSceneLog } from '../../utils/debug-scene-log'
import { captureBootLine } from '../../utils/boot-diagnostics'
import { ensureRuntimeCanvasForWasmBoot } from '../../utils/runtime-canvas'
import { useEditorSelector } from '../../store/editor-store'
import { setRuntimeProfileSample } from '../../utils/runtime-profile-buffer'
import { queueTransformPreview } from '../../utils/transform-preview-store'
import type { ConsoleEntry, ProjectDoc, ScriptFile } from '../../types'
import type { Action as EditorAction } from '../../store/editor-store'

export interface MakeLogEntry { (message: string, level: string): ConsoleEntry }

/** Shared console row shape for runtime boot + preview panels. */
export function makeRuntimeLogEntry(message: string, level: string): ConsoleEntry {
  const validLevels = ['info', 'warn', 'error', 'lua'] as const
  return {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }),
    message,
    level: validLevels.includes(level as never)
      ? (level as ConsoleEntry['level'])
      : 'info',
  }
}

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

function tryCompleteBootHandshake(
  deps: Pick<RuntimeCallbackDeps, 'bootSyncRef' | 'dispatch' | 'makeLogEntry'>,
  source: 'bridge' | 'wasm_ready' | 'project_ready',
): void {
  const wasmLive = isReady()
  const cppWired = isEditorEngineWired()
  // #region agent log
  debugSceneLog('runtime-hooks.ts:tryCompleteBootHandshake', 'boot_handshake', {
    source,
    wasmLive,
    cppWired,
    engineReady: runtimeSync.isEngineReady(),
    hasProject: deps.bootSyncRef.current.project != null,
    bootSynced: runtimeSync.isBootProjectSynced(),
  }, 'H1')
  // #endregion
  if (!wasmLive || !cppWired) return
  runtimeSync.notifyEngineReady()
  scheduleBootProjectSync(deps)
}

/** Engine-ready latch + deferred boot project sync (never inside Module.print). */
function handleEditorEngineReadySignal(
  message: string,
  deps: Pick<RuntimeCallbackDeps, 'bootSyncRef' | 'dispatch' | 'makeLogEntry'>,
): void {
  const isBridge = message.includes('[EditorAPI] Bridge initialised')
  if (!isBridge) return

  const wasReady = runtimeSync.isEngineReady()
  // #region agent log
  debugSceneLog('runtime-hooks.ts:handleEditorEngineReadySignal', 'engine_ready_signal', {
    isBridge,
    wasReady,
    wasmReady: isReady(),
  }, 'H1')
  // #endregion
  tryCompleteBootHandshake(deps, 'bridge')
}

function scheduleBootProjectSync(
  deps: Pick<RuntimeCallbackDeps, 'bootSyncRef' | 'dispatch' | 'makeLogEntry'>,
): void {
  const boot = deps.bootSyncRef.current
  if (boot.project == null) return
  scheduleWasmUiUpdate(() => {
    void performRuntimeProjectSync({
      project: boot.project,
      projectPath: boot.projectPath,
      openScripts: boot.openScripts,
      dialogs: boot.dialogs,
      selectionSceneId: boot.selectionSceneId,
      isPlaying: boot.isPlaying,
      wasmReady: isReady(),
      engineReady: runtimeSync.isEngineReady(),
      dispatch: deps.dispatch,
      makeLogEntry: deps.makeLogEntry,
    })
  }, { urgent: true })
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
      // Boot handshake must not use cancelled() — StrictMode teardown drops it otherwise.
      scheduleWasmUiUpdate(() => {
        tryCompleteBootHandshake(
          { bootSyncRef, dispatch, makeLogEntry },
          'wasm_ready',
        )
      }, { urgent: true })
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
    onEntityTransformPreview: (
      entityId: number, x: number, y: number,
      rotation: number, scaleX: number, scaleY: number,
    ) => {
      queueTransformPreview({
        entityId, x, y, rotation, scaleX, scaleY,
      })
    },
    onConsoleLine: (message: string, level: string) => {
      captureBootLine(message, level)
      // Authoritative engine-ready signal — register it BEFORE the cancelled()
      // guard so a stale/cancelled callbacks instance (StrictMode / dispatch
      // identity churn) can never drop boot's transition to engine-ready.
      handleEditorEngineReadySignal(message, { bootSyncRef, dispatch, makeLogEntry })
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

  // ── Rebind canvas when WASM boot completes (initial load is BootRuntimeLoader) ─
  useEffect(() => {
    if (!canvasReady) return
    const canvas = canvasRef.current
    if (!canvas) return

    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform, sceneIdRef, syncRuntimeUiFlags,
      makeLogEntry, bootSyncRef,
    })

    const attach = (): void => {
      void loadWasmRuntime(canvas, WASM_RUNTIME_SRC, callbacks)
        .then(() => {
          runtimeSync.requestEditorSurfaceSync()
        })
        .catch((err) => {
          console.error('[PreviewPanel] WASM rebind failed:', err)
        })
    }

    if (isReady()) {
      attach()
      return undefined
    }

    return runtimeSync.onReadyChange((ready) => {
      if (ready) attach()
    })
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
      .then(() => {
        runtimeSync.requestEditorSurfaceSync()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dispatch])
}

// ---------------------------------------------------------------------------
// useBootSceneSync — latch scene sync when project arrives after WASM boot
// ---------------------------------------------------------------------------

interface BootSceneSyncOptions {
  project: ProjectDoc | null
  dispatch: Dispatch<EditorAction>
  makeLogEntry: MakeLogEntry
  bootSyncRef: RuntimeCallbackDeps['bootSyncRef']
}

/** Re-run boot handshake when LOAD_PROJECT fires after WASM/engine are live. */
export function useBootSceneSync(opts: BootSceneSyncOptions): void {
  const { project, dispatch, makeLogEntry, bootSyncRef } = opts

  const attempt = useCallback(() => {
    if (project == null) return
    if (runtimeSync.isBootProjectSynced()) return
    tryCompleteBootHandshake(
      { bootSyncRef, dispatch, makeLogEntry },
      'project_ready',
    )
  }, [project, dispatch, makeLogEntry, bootSyncRef])

  useEffect(() => {
    attempt()
  }, [attempt])

  // Project may arrive before WASM/main() finishes; retry when the module flips ready.
  useEffect(() => {
    const unsub = runtimeSync.onReadyChange((ready) => {
      if (ready) attempt()
    })
    return unsub
  }, [attempt])
}

// ---------------------------------------------------------------------------
// useBootHandshakeRetry — poll until engine API latches (survives StrictMode)
// ---------------------------------------------------------------------------

/** Retry boot handshake every frame while WASM is live but engine API is not. */
export function useBootHandshakeRetry(opts: BootSceneSyncOptions): void {
  const { project, dispatch, makeLogEntry, bootSyncRef } = opts

  useEffect(() => {
    let frame = 0
    const maxFrames = 60 * 25
    let raf = 0

    const tick = () => {
      frame++
      if (runtimeSync.isBootProjectSynced() || runtimeSync.isEngineReady()) return
      if (frame >= maxFrames) return
      if (isReady()) {
        tryCompleteBootHandshake(
          { bootSyncRef, dispatch, makeLogEntry },
          'project_ready',
        )
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [project, dispatch, makeLogEntry, bootSyncRef])
}

// ---------------------------------------------------------------------------
// useBootSyncRef — shared project payload for boot handshake
// ---------------------------------------------------------------------------

export function useBootSyncRef(): RuntimeCallbackDeps['bootSyncRef'] {
  const project = useEditorSelector((s) => s.project)
  const projectPath = useEditorSelector((s) => s.projectPath)
  const openScripts = useEditorSelector((s) => s.openScripts)
  const dialogs = useEditorSelector((s) => s.dialogs)
  const selection = useEditorSelector((s) => s.selection)
  const isPlaying = useEditorSelector((s) => s.isPlaying)

  const bootSyncRef = useRef<RuntimeCallbackDeps['bootSyncRef']['current']>({
    project: null,
    projectPath: null,
    openScripts: [],
    dialogs: {},
    selectionSceneId: null,
    isPlaying: false,
  })

  bootSyncRef.current = {
    project,
    projectPath,
    openScripts,
    dialogs,
    selectionSceneId: selection.sceneId,
    isPlaying,
  }

  return bootSyncRef
}

// ---------------------------------------------------------------------------
// useEditorWasmBoot — load game.js once with a body-mounted canvas (boot gate)
// ---------------------------------------------------------------------------

export interface EditorWasmBootOptions {
  dispatch: Dispatch<EditorAction>
  makeLogEntry: MakeLogEntry
  bootSyncRef: RuntimeCallbackDeps['bootSyncRef']
  syncRuntimeUiFlags: () => void
}

/** Start WASM before PreviewPanel layout; canvas stays on document.body until rebind. */
export function useEditorWasmBoot(opts: EditorWasmBootOptions): void {
  const { dispatch, makeLogEntry, bootSyncRef, syncRuntimeUiFlags } = opts
  const sceneIdRef = useRef('')

  useLayoutEffect(() => {
    if (isReady()) return undefined

    const canvas = ensureRuntimeCanvasForWasmBoot()
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch,
      handleRuntimeTransform: () => {},
      sceneIdRef,
      syncRuntimeUiFlags,
      makeLogEntry,
      bootSyncRef,
    })

    void loadWasmRuntime(canvas, WASM_RUNTIME_SRC, callbacks).catch((err) => {
      const msg = `[WASM] Init failed: ${String(err)}`
      captureBootLine(msg, 'error')
      dispatch({
        type: 'LOG',
        entry: makeLogEntry(msg, 'error'),
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])
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
export async function performRuntimeProjectSync(opts: ProjectSyncOptions): Promise<void> {
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
  const syncOk = await runtimeSync.syncProject(project!, runtimeSceneId, projectPath, { mainLua, dialogs })
  // #region agent log
  debugSceneLog('runtime-hooks.ts:performRuntimeProjectSync', 'project_sync_result', {
    syncOk,
    engineReady,
    wasmReady,
    runtimeSceneId,
    bootSynced: runtimeSync.isBootProjectSynced(),
  }, 'H1')
  // #endregion
  runtimeSync.syncPresentationSnapshotNow()
  if (syncOk) {
    runtimeSync.requestEditorSurfaceSync()
  }
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
    void performRuntimeProjectSync({
      project: optsRef.current.project,
      projectPath: optsRef.current.projectPath,
      openScripts: optsRef.current.openScripts,
      dialogs: optsRef.current.dialogs,
      selectionSceneId: optsRef.current.selectionSceneId,
      wasmReady: isReady(),
      engineReady: runtimeSync.isEngineReady(),
      isPlaying: optsRef.current.isPlaying,
      dispatch: optsRef.current.dispatch,
      makeLogEntry: optsRef.current.makeLogEntry,
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
