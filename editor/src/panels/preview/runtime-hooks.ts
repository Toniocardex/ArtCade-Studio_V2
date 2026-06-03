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

import { useEffect, type Dispatch, type MutableRefObject, type RefObject } from 'react'
import {
  loadWasmRuntime, isReady,
  type WasmCallbacks,
} from '../../utils/wasm-bridge'
import { WASM_RUNTIME_SRC } from '../../utils/runtime-path'
import { runtimeSync, type EditorTool } from '../../utils/runtime-sync-service'
import {
  getPreviewLuaSyncKey,
  logLogicBoardCompileFailure,
  resolvePreviewMainLuaWithStatus,
} from '../../utils/preview-restore'
import { performRuntimeSceneAssetSync } from './runtime-asset-sync'
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
}

export function buildRuntimeCallbacks(deps: RuntimeCallbackDeps): WasmCallbacks {
  const {
    cancelled, dispatch,
    handleRuntimeTransform, sceneIdRef, syncRuntimeUiFlags, makeLogEntry,
  } = deps
  return {
    onReady: () => {
      syncRuntimeUiFlags()
      // Broadcast readiness so non-PreviewPanel consumers (LogicBoardPanel
      // Apply, Script editor Hot-Reload, etc.) can transition out of their
      // "runtime still loading" state without waiting for a re-render of
      // the preview panel.
      runtimeSync.notifyReadyChanged()
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
    onEntityTransformChanged: (
      entityId: number, x: number, y: number,
      rotation: number, scaleX: number, scaleY: number,
    ) => {
      scheduleWasmUiUpdateWhen(cancelled, () => {
        handleRuntimeTransform(entityId, x, y, rotation, scaleX, scaleY)
      }, { urgent: true })
    },
    onConsoleLine: (message: string, level: string) => {
      // EditorAPI errors must reach the console even if an older lifecycle
      // hook marked itself cancelled (e.g. StrictMode / dispatch identity churn).
      const forceLog =
        level === 'error' ||
        (level === 'warn' && message.includes('[EditorAPI]'))
      if (cancelled() && !forceLog) return
      const entry = makeLogEntry(message, level)
      if (message.includes('[EditorAPI] Bridge initialised')) {
        scheduleWasmUiUpdateWhen(cancelled, () => {
          runtimeSync.notifyEngineReady()
        }, { urgent: true })
      }
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
    onTilemapPainted: (col: number, row: number, tileId: number) => {
      if (cancelled()) return
      const sceneId = sceneIdRef.current
      if (!sceneId) return
      scheduleWasmUiUpdateWhen(cancelled, () => {
        dispatch({
          type: 'TILEMAP_PAINT_CELL', sceneId, col, row, tileId,
        })
      }, { urgent: true })
    },
    onSpriteFillColor: (entityId: number, r: number, g: number, b: number) => {
      scheduleWasmUiUpdateWhen(cancelled, () => {
        dispatch({
          type: 'ENTITY_SET_SPRITE_FILL',
          entityId,
          fillColor: { x: r, y: g, z: b },
        })
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
  mode: string
  dispatch: Dispatch<EditorAction>
  sceneIdRef: MutableRefObject<string>
  syncRuntimeUiFlags: () => void
  handleRuntimeTransform: (
    entityId: number, x: number, y: number,
    rotation: number, scaleX: number, scaleY: number,
  ) => void
  makeLogEntry: MakeLogEntry
}

export function useWasmRuntimeLifecycle(opts: LifecycleOptions): void {
  const {
    canvasRef, mode, dispatch,
    sceneIdRef, syncRuntimeUiFlags, handleRuntimeTransform, makeLogEntry,
  } = opts

  // ── Mount (once per dispatch identity) ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => cancelled,
      dispatch,
      handleRuntimeTransform, sceneIdRef, syncRuntimeUiFlags,
      makeLogEntry,
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
  }, [dispatch])

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
      makeLogEntry,
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
  if (!shouldSyncProjectToRuntime({ wasmReady, engineReady, project, isPlaying })) return
  if (runtimeSync.isTransitioning()) return
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
  const previewLuaSyncKey =
    opts.project != null
      ? getPreviewLuaSyncKey({
          project: opts.project,
          openScripts: opts.openScripts,
          projectPath: opts.projectPath,
        })
      : ''

  useEffect(() => {
    performRuntimeProjectSync(opts)
  }, [
    previewLuaSyncKey,
    opts.dialogs,
    opts.selectionSceneId,
    opts.wasmReady,
    opts.engineReady,
    opts.isPlaying,
    opts.dispatch,
    opts.makeLogEntry,
  ])
}

// ---------------------------------------------------------------------------
// useRuntimeEditorSync — drive every per-frame editor channel via the service
// ---------------------------------------------------------------------------

interface EditorSyncOptions {
  wasmReady: boolean
  engineReady: boolean
  isPlaying: boolean
  selectedEntityId: number | null
  tool: EditorTool
  selectedTileCell: number
  guides: boolean
  gridSize: number
  snapToGrid: boolean
}

export function useRuntimeEditorSync(opts: EditorSyncOptions): void {
  const {
    wasmReady, engineReady,
    isPlaying, selectedEntityId, tool, selectedTileCell,
    guides, gridSize, snapToGrid,
  } = opts

  useEffect(() => {
    if (!wasmReady || !engineReady) return
    runtimeSync.syncPlayMode(isPlaying)
  }, [isPlaying, wasmReady, engineReady])

  useEffect(() => {
    if (!wasmReady || !engineReady) return
    runtimeSync.syncSelection(selectedEntityId)
  }, [selectedEntityId, wasmReady, engineReady])

  useEffect(() => {
    if (!wasmReady || !engineReady) return
    runtimeSync.syncEditorTool(tool, selectedTileCell)
  }, [tool, selectedTileCell, wasmReady, engineReady])

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
  previewAssetLoadScope: 'scene-static' | 'scene+spawn-prototypes'
}

export function useRuntimeAssetUpload(opts: AssetUploadOptions): void {
  const {
    project, projectPath, activeSceneId, wasmReady, engineReady, previewAssetLoadScope,
  } = opts
  useEffect(() => {
    if (!wasmReady || !engineReady || !project || !activeSceneId) return
    performRuntimeSceneAssetSync(project, activeSceneId, projectPath, {
      scope: previewAssetLoadScope,
    })
  }, [project, projectPath, activeSceneId, wasmReady, engineReady, previewAssetLoadScope])
}
