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
  editorRegisterImage,
  type WasmCallbacks,
} from '../../utils/wasm-bridge'
import { WASM_RUNTIME_SRC } from '../../utils/runtime-path'
import { runtimeSync, type EditorTool } from '../../utils/runtime-sync-service'
import { resolvePreviewMainLua } from '../../utils/preview-restore'
import { readProjectImageBytes } from '../../utils/api'
import { dirName } from '../../utils/project'
import type { ConsoleEntry, ProjectDoc, ScriptFile } from '../../types'
import type { Action as EditorAction } from '../../store/editor-store'

export interface MakeLogEntry { (message: string, level: string): ConsoleEntry }

// ---------------------------------------------------------------------------
// buildRuntimeCallbacks — single source of truth for the C++→React contract
// ---------------------------------------------------------------------------

export interface RuntimeCallbackDeps {
  cancelled: () => boolean
  dispatch: Dispatch<EditorAction>
  setEngineReady: (ready: boolean) => void
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
    cancelled, dispatch, setEngineReady,
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
      if (cancelled()) return
      setTimeout(() => dispatch({
        type: 'LOG',
        entry: makeLogEntry('[WASM] Runtime initialised — editor mode active.', 'info'),
      }), 0)
    },
    onEntitySelected: (entityId: number) => {
      if (cancelled()) return
      dispatch({ type: 'SELECT_ENTITY', entityId })
    },
    onEntityTransformChanged: (
      entityId: number, x: number, y: number,
      rotation: number, scaleX: number, scaleY: number,
    ) => {
      if (cancelled()) return
      setTimeout(() => {
        if (!cancelled()) handleRuntimeTransform(entityId, x, y, rotation, scaleX, scaleY)
      }, 0)
    },
    onConsoleLine: (message: string, level: string) => {
      if (cancelled()) return
      const entry = makeLogEntry(message, level)
      if (message.includes('[EditorAPI] Bridge initialised')) {
        setTimeout(() => { if (!cancelled()) setEngineReady(true) }, 0)
      }
      setTimeout(() => dispatch({ type: 'LOG', entry }), 0)
    },
    onTilemapPainted: (col: number, row: number, tileId: number) => {
      if (cancelled()) return
      const sceneId = sceneIdRef.current
      if (!sceneId) return
      setTimeout(() => dispatch({
        type: 'TILEMAP_PAINT_CELL', sceneId, col, row, tileId,
      }), 0)
    },
    onSpriteFillColor: (entityId: number, r: number, g: number, b: number) => {
      if (cancelled()) return
      setTimeout(() => {
        if (!cancelled()) {
          dispatch({
            type: 'ENTITY_SET_SPRITE_FILL',
            entityId,
            fillColor: { x: r, y: g, z: b },
          })
        }
      }, 0)
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
  setEngineReady: (b: boolean) => void
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
    canvasRef, mode, dispatch, setEngineReady,
    sceneIdRef, syncRuntimeUiFlags, handleRuntimeTransform, makeLogEntry,
  } = opts

  // ── Mount (once per dispatch identity) ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    const callbacks = buildRuntimeCallbacks({
      cancelled: () => cancelled,
      dispatch, setEngineReady,
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
    // We intentionally re-run only when the dispatch identity changes (i.e.
    // when EditorProvider remounts). Other deps are stable refs/callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])

  // ── Rebind canvas when returning to Canvas view ──────────────────────────
  useEffect(() => {
    if (mode !== 'canvas') return
    const canvas = canvasRef.current
    if (!canvas || !isReady()) return
    syncRuntimeUiFlags()
    void loadWasmRuntime(canvas, WASM_RUNTIME_SRC, buildRuntimeCallbacks({
      cancelled: () => false,
      dispatch, setEngineReady,
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
  selectionSceneId: string | null
  wasmReady: boolean
  engineReady: boolean
  isPlaying: boolean
}

export function useRuntimeProjectSync(opts: ProjectSyncOptions): void {
  const {
    project, projectPath, openScripts, selectionSceneId,
    wasmReady, engineReady, isPlaying,
  } = opts
  useEffect(() => {
    if (!shouldSyncProjectToRuntime({ wasmReady, engineReady, project, isPlaying })) return
    const runtimeSceneId = selectionSceneId ?? project!.activeSceneId
    const mainLua = resolvePreviewMainLua({ project: project!, openScripts })
    runtimeSync.syncProject(project!, runtimeSceneId, projectPath, { mainLua })
  }, [project, projectPath, openScripts, selectionSceneId, wasmReady, engineReady, isPlaying])
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
}

export function useRuntimeEditorSync(opts: EditorSyncOptions): void {
  const {
    wasmReady, engineReady,
    isPlaying, selectedEntityId, tool, selectedTileCell,
    guides, gridSize,
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
    runtimeSync.syncEditorChrome({ guides, gridSize, isPlaying })
  }, [guides, gridSize, isPlaying, wasmReady, engineReady])
}

// ---------------------------------------------------------------------------
// useRuntimeAssetUpload — push ProjectDoc.assets into the C++ texture cache
// ---------------------------------------------------------------------------

interface AssetUploadOptions {
  project: ProjectDoc | null
  projectPath: string | null
  wasmReady: boolean
  engineReady: boolean
  registeredAssetsRef: MutableRefObject<Set<string>>
}

export function useRuntimeAssetUpload(opts: AssetUploadOptions): void {
  const { project, projectPath, wasmReady, engineReady, registeredAssetsRef } = opts
  useEffect(() => {
    if (!wasmReady || !engineReady || !project?.assets) return
    const root = projectPath ? dirName(projectPath) : ''
    const assets = project.assets
    void (async () => {
      for (const asset of Object.values(assets)) {
        const key = `${asset.path}#${asset.dataUrl ? 'd' : 'f'}`
        if (registeredAssetsRef.current.has(key)) continue
        let bytes: Uint8Array | null = null
        if (asset.dataUrl) {
          try {
            const b64 = asset.dataUrl.split(',')[1] ?? ''
            const bin = atob(b64)
            const u8  = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
            bytes = u8
          } catch { bytes = null }
        } else if (root) {
          bytes = await readProjectImageBytes(root, asset.path)
        }
        if (!bytes || bytes.length === 0) continue
        const ext = `.${(asset.path.split('.').pop() ?? 'png').toLowerCase()}`
        if (editorRegisterImage(asset.path, bytes, ext))
          registeredAssetsRef.current.add(key)
      }
    })()
  }, [project, projectPath, wasmReady, engineReady, registeredAssetsRef])
}
