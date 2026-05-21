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

import {
  editorDeselect,
  editorLoadProject,
  editorSelectEntity,
  editorSetGridSize,
  editorSetGuidesEnabled,
  editorSetMode,
  editorSetSelectedTile,
  editorSetTool,
  editorSetTransform,
  isReady,
} from './wasm-bridge'
import { runtimeProjectFingerprint } from './runtime-fingerprint'
import type { ProjectDoc } from '../types'

// ---------------------------------------------------------------------------
// Public domain types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const TRANSFORM_EPSILON = 1e-4

class RuntimeSyncServiceImpl {
  private lastLoadKey:        string | null = null
  private lastMode:           0 | 1 | null = null
  private lastSelection:      number | null | undefined = undefined
  private lastTool:           EditorTool | null = null
  private lastTileBrush:      number | null = null
  private lastGuides:         boolean | null = null
  private lastGridSize:       number | null = null
  private lastTransform:      Map<number, EntityTransformSnapshot> = new Map()

  /** Forget every cached "last sent" value. Use on project open / runtime reload. */
  reset(): void {
    this.lastLoadKey   = null
    this.lastMode      = null
    this.lastSelection = undefined
    this.lastTool      = null
    this.lastTileBrush = null
    this.lastGuides    = null
    this.lastGridSize  = null
    this.lastTransform.clear()
  }

  /** True if the runtime is ready to accept commands. */
  isReady(): boolean {
    return isReady()
  }

  // ── Project ────────────────────────────────────────────────────────────────

  /**
   * Push the project into C++ via `editor_load_project` IFF the
   * runtime-affecting subset (see runtime-fingerprint.ts) actually changed.
   *
   * Returns true when a sync was performed.
   */
  syncProject(
    project: ProjectDoc,
    activeSceneId: string,
    projectPath: string | null,
  ): boolean {
    if (!isReady()) return false
    const fp = runtimeProjectFingerprint(project, activeSceneId)
    const loadKey = `${projectPath ?? ''}|${fp}`
    if (this.lastLoadKey === loadKey) return false
    this.lastLoadKey = loadKey
    editorLoadProject(JSON.stringify({ ...project, activeSceneId }))
    return true
  }

  // ── Mode / selection / chrome / tool ──────────────────────────────────────

  syncPlayMode(isPlaying: boolean): void {
    if (!isReady()) return
    const next: 0 | 1 = isPlaying ? 1 : 0
    if (this.lastMode === next) return
    this.lastMode = next
    editorSetMode(next)
  }

  syncSelection(entityId: number | null): void {
    if (!isReady()) return
    if (this.lastSelection === entityId) return
    this.lastSelection = entityId
    if (entityId == null) editorDeselect()
    else editorSelectEntity(entityId)
  }

  syncEditorTool(tool: EditorTool, selectedTileCell: number): void {
    if (!isReady()) return
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
    if (!isReady()) return
    const guidesEffective = state.guides && !state.isPlaying
    if (this.lastGuides !== guidesEffective) {
      this.lastGuides = guidesEffective
      editorSetGuidesEnabled(guidesEffective)
    }
    if (this.lastGridSize !== state.gridSize) {
      this.lastGridSize = state.gridSize
      editorSetGridSize(state.gridSize)
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
    if (!isReady()) return false
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

  forgetEntity(entityId: number): void {
    this.lastTransform.delete(entityId)
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
