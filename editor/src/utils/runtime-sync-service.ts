// ---------------------------------------------------------------------------
// runtime-sync-service — the ONE place that talks to the WASM runtime
// ---------------------------------------------------------------------------
//
// Before this module:
//   • PreviewPanel had 5 useEffects each calling editorSet* directly;
//   • InspectorPanel called editorSetTransform on its own;
//   • the project sync hook owned its own fingerprint ref.
//
// That mixed strategy left the contract "what reaches the runtime, when?"
// implicit, which is exactly the surface that produced the P1/P2 regressions
// captured in docs/TECHNICAL_DEBT_REVIEW.md.
//
// House rule: outside this file and wasm-bridge itself, NOTHING in the editor
// is allowed to call `editor_*` / `syncEditorRuntimeState`. Panels go through
// the singleton exported below (or through the React hooks built on top of
// it). New runtime channels (e.g. shader push, audio bus) get a method here.

import { useEffect, useState } from 'react'
import {
  editorDeselect,
  editorLoadProject,
  editorLoadDialogs,
  editorRestoreFromProject,
  editorReloadScript,
  editorEnterPlayMode,
  editorExitPlayMode,
  EditorApiResult,
  EDITOR_API_CCALL_FAILED,
  peekWasmBridgeLastError,
  editorSelectEntity,
  editorSetGridSize,
  editorSetGuidesEnabled,
  editorSetMode,
  editorSetSceneSettings,
  editorSetSelectedTile,
  editorSetTool,
  editorSetTransform,
  editorUpdateEntity,
  isReady as isWasmReady,
} from './wasm-bridge'
import {
  projectJsonForRuntime,
  runtimeProjectProjection,
  type RuntimeProjection,
} from './runtime-fingerprint'
import { planProjectSync, type ProjectSyncPlan } from './runtime-sync-diff'
import type { ProjectDoc } from '../types'
import type { DialogScript } from './dialog/dialog-script'
import { dialogsJsonForRuntime } from './dialog/runtime-dialogs'

// ---------------------------------------------------------------------------
// Public domain types
// ---------------------------------------------------------------------------

export type ApplyMainLuaStatus = 'reloaded' | 'unchanged' | 'not_ready' | 'failed'

export interface ApplyMainLuaResult {
  status: ApplyMainLuaStatus
  /** Present for `not_ready` and `failed`. */
  message?: string
}

export interface PlayTransitionResult {
  ok: boolean
  /** C++ EditorApiResult or EDITOR_API_CCALL_FAILED. */
  code: number
  message?: string
}

export function messageForEditorApiCode(code: number): string {
  if (code === EDITOR_API_CCALL_FAILED) {
    return peekWasmBridgeLastError() ?? 'WASM call failed.'
  }
  switch (code) {
    case EditorApiResult.Ok:
      return ''
    case EditorApiResult.JsonError:
      return 'Project could not be applied to the runtime.'
    case EditorApiResult.LuaError:
      return 'Lua script failed to load (see console for details).'
    case EditorApiResult.NotWired:
      return 'WASM runtime is not ready yet.'
    default:
      return `Runtime error (code ${code}).`
  }
}

export type EditorTool = 'select' | 'pan' | 'paint' | 'erase' | 'tile'

/** Numeric ids the C++ runtime expects from `editor_set_tool`. */
const TOOL_ID: Record<EditorTool, number> = {
  select: 0,
  pan:    1,
  paint:  2,
  erase:  3,
  tile:   2,
}

export interface EditorChromeState {
  guides:   boolean
  gridSize: number
  /** Guides must be hidden while the game is playing even if the toggle is on. */
  isPlaying: boolean
}

export interface EntityTransformSnapshot {
  entityId: number
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export interface SyncProjectOptions {
  /** After a structural full reload in EDIT, hot-reload main Lua (avoids empty tick stub). */
  mainLua?: string
  /** Dialog library from editor store (preview has no dialogs/ folder until save). */
  dialogs?: Record<string, DialogScript>
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const TRANSFORM_EPSILON = 1e-4

// Editor grid minimum + fallback. The C++ side (editor_set_grid_size in
// editor-api.cpp) silently clamps anything < 4 to 32; mirror that here
// so the JS cache stores the EFFECTIVE value rather than the requested
// one. Without this, asking for grid=3 would make lastGridSize===3
// permanently, so a later honest grid=3 request would short-circuit and
// the C++ side would stay at 32 forever — JS and runtime out of sync.
const GRID_SIZE_MIN     = 4
const GRID_SIZE_FALLBACK = 32

function effectiveGridSize(requested: number): number {
  if (!Number.isFinite(requested) || requested < GRID_SIZE_MIN)
    return GRID_SIZE_FALLBACK
  return requested
}

class RuntimeSyncServiceImpl {
  private lastLoadKey:        string | null = null
  private lastMainLua:        string | null = null
  private lastDialogsKey:     string | null = null
  private lastProjection:     RuntimeProjection | null = null
  private lastMode:           0 | 1 | null = null
  private lastSelection:      number | null | undefined = undefined
  private lastTool:           EditorTool | null = null
  private lastTileBrush:      number | null = null
  private lastGuides:         boolean | null = null
  private lastGridSize:       number | null = null
  private readonly lastTransform: Map<number, EntityTransformSnapshot> = new Map()
  private assetCacheInvalidator: (() => void) | null = null
  private readonly readyListeners: Set<(ready: boolean) => void> = new Set()
  // Seed from the actual bridge state so a Vite HMR rehydration (wasm
  // already alive when this module is re-evaluated) does NOT trigger a
  // duplicate "false → true" broadcast on the next genuine onReady.
  private lastReadyEmitted:   boolean = isWasmReady()
  private transitionDepth = 0
  private lastScriptReloadMessage: string | null = null

  /** True while PLAY/STOP/restore runs — blocks competing project sync from React effects. */
  isTransitioning(): boolean {
    return this.transitionDepth > 0
  }

  private runTransition<T>(fn: () => T): T {
    this.transitionDepth++
    try {
      return fn()
    } finally {
      this.transitionDepth--
    }
  }

  /** Forget every cached "last sent" value. Use on project open / runtime reload. */
  reset(): void {
    this.lastLoadKey   = null
    this.lastMainLua   = null
    this.lastDialogsKey = null
    this.lastProjection = null
    this.lastMode      = null
    this.lastSelection = undefined
    this.lastTool      = null
    this.lastTileBrush = null
    this.lastGuides    = null
    this.lastGridSize  = null
    this.lastTransform.clear()
  }

  /** PreviewPanel registers this so texture re-upload runs after STOP restore. */
  setAssetCacheInvalidator(fn: (() => void) | null): void {
    this.assetCacheInvalidator = fn
  }

  /**
   * Subscribe to runtime-readiness transitions. The callback receives the
   * current state synchronously, then again whenever it changes. Useful for
   * panels (e.g. LogicBoardPanel) that gate Apply on `isReady()` and want
   * to update their UI the moment the WASM finishes loading instead of
   * leaving the user staring at a misleading "Runtime not loaded" toast.
   *
   * Returns an unsubscribe handle.
   */
  onReadyChange(cb: (ready: boolean) => void): () => void {
    this.readyListeners.add(cb)
    cb(isWasmReady())
    return () => { this.readyListeners.delete(cb) }
  }

  /** Called from the wasm-bridge `onReady` (or any path that toggles ready). */
  notifyReadyChanged(): void {
    const now = isWasmReady()
    if (now === this.lastReadyEmitted) return
    this.lastReadyEmitted = now
    for (const cb of this.readyListeners) cb(now)
  }

  /**
   * STOP / Logic Board Apply: reload design-time ProjectDoc into C++, reset
   * gameplay modules, then hot-reload the main Lua script.
   */
  restorePreviewFromProject(
    project: ProjectDoc,
    activeSceneId: string,
    mainLua: string,
    dialogs?: Record<string, DialogScript>,
    projectPath?: string | null,
  ): boolean {
    return this.exitPlaySession(project, activeSceneId, mainLua, dialogs, projectPath).ok
  }

  /**
   * Atomic STOP: C++ restores design state and loads design-time Lua in one transaction.
   */
  exitPlaySession(
    project: ProjectDoc,
    activeSceneId: string,
    mainLua: string,
    dialogs?: Record<string, DialogScript>,
    projectPath?: string | null,
  ): PlayTransitionResult {
    return this.runTransition(() => {
      if (!isWasmReady()) {
        return {
          ok: false,
          code: EditorApiResult.NotWired,
          message: messageForEditorApiCode(EditorApiResult.NotWired),
        }
      }
      const code = editorExitPlayMode(
        projectJsonForRuntime(project, activeSceneId),
        mainLua,
      )
      if (code !== EditorApiResult.Ok) {
        return { ok: false, code, message: messageForEditorApiCode(code) }
      }
      this.reset()
      this.lastMode = 0
      this.lastMainLua = mainLua
      this.syncDialogs(dialogs ?? {})
      const projection = runtimeProjectProjection(project, activeSceneId)
      const loadKey = `${projectPath ?? ''}|${JSON.stringify(projection)}`
      this.latchProjectProjection(loadKey, projection)
      this.assetCacheInvalidator?.()
      return { ok: true, code: EditorApiResult.Ok }
    })
  }

  /**
   * Atomic PLAY: sync project, dialogs, Lua, and enter simulation mode in one transaction.
   */
  enterPlaySession(
    project: ProjectDoc,
    activeSceneId: string,
    mainLua: string,
    dialogs: Record<string, DialogScript>,
    projectPath?: string | null,
  ): PlayTransitionResult {
    return this.runTransition(() => {
      if (!isWasmReady()) {
        return {
          ok: false,
          code: EditorApiResult.NotWired,
          message: messageForEditorApiCode(EditorApiResult.NotWired),
        }
      }
      const code = editorEnterPlayMode(
        projectJsonForRuntime(project, activeSceneId),
        mainLua,
        dialogsJsonForRuntime(dialogs),
      )
      if (code !== EditorApiResult.Ok) {
        return { ok: false, code, message: messageForEditorApiCode(code) }
      }
      this.lastMainLua = mainLua
      this.lastMode = 1
      const projection = runtimeProjectProjection(project, activeSceneId)
      const loadKey = `${projectPath ?? ''}|${JSON.stringify(projection)}`
      this.latchProjectProjection(loadKey, projection)
      this.lastDialogsKey = dialogsJsonForRuntime(dialogs)
      return { ok: true, code: EditorApiResult.Ok }
    })
  }

  /** Push dialog graphs compiled from the editor library into the WASM runtime. */
  syncDialogs(dialogs: Record<string, DialogScript>): boolean {
    if (!isWasmReady()) return false
    const payload = dialogsJsonForRuntime(dialogs)
    if (payload === this.lastDialogsKey) return false
    this.lastDialogsKey = payload
    editorLoadDialogs(payload)
    return true
  }

  /**
   * Before PLAY: hot-reload main Lua + dialog graphs (logic board edits do not
   * change the project fingerprint, so preview would otherwise keep a stub).
   */
  /**
   * Hot-reload main Lua from Logic Board Apply or script saves.
   * Updates the internal cache so later syncProject does not skip reload.
   */
  applyMainLua(mainLua: string): ApplyMainLuaResult {
    if (!isWasmReady()) {
      return {
        status: 'not_ready',
        message: 'WASM runtime is not ready yet.',
      }
    }
    const outcome = this.reloadMainLuaIfChanged(mainLua)
    if (outcome === 'unchanged') return { status: 'unchanged' }
    if (outcome === 'failed') {
      return {
        status: 'failed',
        message: this.lastScriptReloadMessage ?? 'Script hot-reload failed.',
      }
    }
    return { status: 'reloaded' }
  }

  /** Hot-reload main Lua when the compiled source changes (logic boards, script tab). */
  private reloadMainLuaIfChanged(
    mainLua: string,
    opts?: { force?: boolean },
  ): 'reloaded' | 'unchanged' | 'failed' {
    if (!opts?.force && mainLua === this.lastMainLua) return 'unchanged'
    const code = editorReloadScript(mainLua)
    if (code === EDITOR_API_CCALL_FAILED || code !== EditorApiResult.Ok) {
      const detail = messageForEditorApiCode(code)
      this.lastScriptReloadMessage = detail
      console.warn('[runtime-sync] Script hot-reload failed:', detail)
      return 'failed'
    }
    this.lastScriptReloadMessage = null
    this.lastMainLua = mainLua
    return 'reloaded'
  }

  private latchProjectProjection(loadKey: string, projection: RuntimeProjection): void {
    this.lastLoadKey = loadKey
    this.lastProjection = projection
  }

  private applyIncrementalSync(project: ProjectDoc, plan: ProjectSyncPlan): boolean {
    if (plan.kind !== 'incremental') return false
    for (const entityId of plan.entityIds) {
      const def = project.entities[entityId]
      if (!def) continue
      editorUpdateEntity(entityId, JSON.stringify(def))
      const t = def.transform
      this.lastTransform.set(entityId, {
        entityId,
        x: t.position.x,
        y: t.position.y,
        rotation: t.rotation,
        scaleX: t.scale.x,
        scaleY: t.scale.y,
      })
    }
    for (const sceneId of plan.sceneIds) {
      const scene = project.scenes[sceneId]
      if (!scene) continue
      editorSetSceneSettings(sceneId, JSON.stringify({
        id: scene.id,
        worldSize: scene.worldSize,
        viewportSize: scene.viewportSize,
        backgroundColor: scene.backgroundColor,
      }))
    }
    return plan.entityIds.length > 0 || plan.sceneIds.length > 0
  }

  /** True if the runtime is ready to accept commands. */
  isReady(): boolean {
    return isWasmReady()
  }

  // ── Project ────────────────────────────────────────────────────────────────

  /**
   * Push project changes into C++. Uses incremental `editor_update_entity` /
   * `editor_set_scene_settings` when only Inspector-level fields changed;
   * falls back to `editor_load_project` for structural edits (entity add/remove,
   * scene membership, tilemap meta, active scene switch).
   *
   * Returns true when any sync was performed.
   */
  syncProject(
    project: ProjectDoc,
    activeSceneId: string,
    projectPath: string | null,
    options?: SyncProjectOptions,
  ): boolean {
    if (!isWasmReady()) return false
    let didWork = false
    if (options?.dialogs && this.syncDialogs(options.dialogs)) didWork = true
    if (options?.mainLua && this.reloadMainLuaIfChanged(options.mainLua) === 'reloaded') {
      didWork = true
    }

    const projection = runtimeProjectProjection(project, activeSceneId)
    const fp = JSON.stringify(projection)
    const loadKey = `${projectPath ?? ''}|${fp}`
    if (this.lastLoadKey === loadKey) return didWork

    const plan = planProjectSync(this.lastProjection, project, activeSceneId)

    if (plan.kind === 'full') {
      this.latchProjectProjection(loadKey, projection)
      editorLoadProject(projectJsonForRuntime(project, activeSceneId))
      // C++ load resets Lua to an empty stub; always follow with the real script.
      if (options?.mainLua && this.reloadMainLuaIfChanged(options.mainLua) === 'failed') {
        return false
      }
      return true
    }

    if (plan.kind === 'none') {
      this.latchProjectProjection(loadKey, projection)
      return didWork
    }

    const incremental = this.applyIncrementalSync(project, plan)
    this.latchProjectProjection(loadKey, projection)
    return didWork || incremental
  }

  // ── Mode / selection / chrome / tool ──────────────────────────────────────

  syncPlayMode(isPlaying: boolean): void {
    if (!isWasmReady()) return
    const next: 0 | 1 = isPlaying ? 1 : 0
    if (this.lastMode === next) return
    this.lastMode = next
    editorSetMode(next)
  }

  syncSelection(entityId: number | null): void {
    if (!isWasmReady()) return
    if (this.lastSelection === entityId) return
    this.lastSelection = entityId
    if (entityId == null) editorDeselect()
    else editorSelectEntity(entityId)
  }

  syncEditorTool(tool: EditorTool, selectedTileCell: number): void {
    if (!isWasmReady()) return
    if (this.lastTool !== tool) {
      this.lastTool = tool
      editorSetTool(TOOL_ID[tool])
    }
    const painting = tool === 'tile' || tool === 'paint' || tool === 'erase'
    if (painting) {
      const brush = tool === 'erase' ? 0 : selectedTileCell
      if (this.lastTileBrush !== brush) {
        this.lastTileBrush = brush
        editorSetSelectedTile(brush)
      }
    }
  }

  syncEditorChrome(state: EditorChromeState): void {
    if (!isWasmReady()) return
    const guidesEffective = state.guides && !state.isPlaying
    if (this.lastGuides !== guidesEffective) {
      this.lastGuides = guidesEffective
      editorSetGuidesEnabled(guidesEffective)
    }
    const grid = effectiveGridSize(state.gridSize)
    if (this.lastGridSize !== grid) {
      this.lastGridSize = grid
      editorSetGridSize(grid)
    }
  }

  // ── Entity transform ──────────────────────────────────────────────────────

  /**
   * Push an entity transform back into C++. Skips the call when the snapshot
   * is identical (within TRANSFORM_EPSILON) to the last value we sent — this
   * avoids feedback loops with the runtime's own mouse-up echo.
   *
   * Returns true when a sync was performed.
   */
  syncEntityTransform(snap: EntityTransformSnapshot): boolean {
    if (!isWasmReady()) return false
    const prev = this.lastTransform.get(snap.entityId)
    if (prev && sameTransform(prev, snap)) return false
    this.lastTransform.set(snap.entityId, snap)
    editorSetTransform(snap.entityId, snap.x, snap.y, snap.rotation, snap.scaleX, snap.scaleY)
    return true
  }

  /**
   * Record a transform value as "already in sync" without sending it. Used
   * when React commits a transform that came FROM the runtime (echo), to
   * avoid bouncing the same value back.
   */
  noteTransform(snap: EntityTransformSnapshot): void {
    this.lastTransform.set(snap.entityId, snap)
  }
}

function sameTransform(a: EntityTransformSnapshot, b: EntityTransformSnapshot): boolean {
  return a.entityId === b.entityId &&
    Math.abs(a.x - b.x) < TRANSFORM_EPSILON &&
    Math.abs(a.y - b.y) < TRANSFORM_EPSILON &&
    Math.abs(a.rotation - b.rotation) < TRANSFORM_EPSILON &&
    Math.abs(a.scaleX - b.scaleX) < TRANSFORM_EPSILON &&
    Math.abs(a.scaleY - b.scaleY) < TRANSFORM_EPSILON
}

/**
 * Process-wide singleton. The runtime itself is a singleton (one WASM module
 * per window) so a single sync state on the React side is the simplest fit.
 *
 * Exported as the implementation type so tests can `instanceof` / reset it.
 */
export const runtimeSync = new RuntimeSyncServiceImpl()
export type RuntimeSyncService = RuntimeSyncServiceImpl

/**
 * React hook that returns the current runtime-readiness state and re-renders
 * the caller whenever it changes. Components outside PreviewPanel that need
 * to gate UI on `isReady()` should use this instead of polling — that's the
 * only way they learn about the transition without sitting inside the
 * Preview's local state.
 */
export function useRuntimeReady(): boolean {
  const [ready, setReady] = useState(() => isWasmReady())
  useEffect(() => runtimeSync.onReadyChange(setReady), [])
  return ready
}
