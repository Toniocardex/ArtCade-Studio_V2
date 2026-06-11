// ---------------------------------------------------------------------------
// Unified project undo/redo (full ProjectDoc snapshots).
// Replaces logic-board-only history per report alignment (Editor Command System).
// ---------------------------------------------------------------------------

import type { CoreState } from './editor-store-state'
import type { ProjectDoc } from '../types'
import type { Action } from './editor-store-state'

export const MAX_PROJECT_HISTORY = 50

export type ProjectHistory = {
  past: ProjectDoc[]
  future: ProjectDoc[]
}

export const emptyProjectHistory = (): ProjectHistory => ({
  past: [],
  future: [],
})

/** Stable revision for deduplicating consecutive identical snapshots. */
export function projectRevision(project: ProjectDoc): string {
  return JSON.stringify({
    projectName: project.projectName,
    targetFPS: project.targetFPS,
    activeSceneId: project.activeSceneId,
    mainScriptPath: project.mainScriptPath,
    world: project.world,
    entities: project.entities,
    scenes: project.scenes,
    objectTypes: project.objectTypes,
    logicBoards: project.logicBoards,
    assets: project.assets,
    audioAssets: project.audioAssets,
    fontAssets: project.fontAssets,
    assetVirtualFolders: project.assetVirtualFolders,
    thumbnails: project.thumbnails,
    tilesets: project.tilesets,
    tilePalette: project.tilePalette,
    layers: project.layers,
  })
}

function cloneProject(project: ProjectDoc): ProjectDoc {
  return structuredClone(project)
}

export function canUndoProject(state: CoreState): boolean {
  return (state.projectHistory?.past.length ?? 0) > 0
}

export function canRedoProject(state: CoreState): boolean {
  return (state.projectHistory?.future.length ?? 0) > 0
}

/** Record a pre-mutation snapshot onto `nextState` (post-reducer apply). */
export function pushProjectHistory(state: CoreState, nextState: CoreState): CoreState {
  if (!state.project || !nextState.project) return nextState
  const hist = nextState.projectHistory ?? emptyProjectHistory()
  const currentRev = projectRevision(state.project)
  const last = hist.past[hist.past.length - 1]
  if (last && projectRevision(last) === currentRev) {
    return nextState
  }
  const snap = cloneProject(state.project)
  const past = [...hist.past, snap].slice(-MAX_PROJECT_HISTORY)
  return {
    ...nextState,
    projectHistory: { past, future: [] },
  }
}

/** SNAPSHOT_PROJECT_HISTORY — push without a following mutation. */
export function snapshotProjectHistory(state: CoreState): CoreState {
  if (!state.project) return state
  const hist = state.projectHistory ?? emptyProjectHistory()
  const currentRev = projectRevision(state.project)
  const last = hist.past[hist.past.length - 1]
  if (last && projectRevision(last) === currentRev) {
    return state
  }
  const snap = cloneProject(state.project)
  const past = [...hist.past, snap].slice(-MAX_PROJECT_HISTORY)
  return {
    ...state,
    projectHistory: { past, future: [] },
  }
}

function reconcileSelection(
  state: CoreState,
  project: ProjectDoc,
): CoreState['selection'] {
  const sel = state.selection
  let entityId = sel.entityId
  if (entityId !== null && !project.entities[entityId]) {
    entityId = null
  }
  let sceneId = sel.sceneId
  if (sceneId && !project.scenes[sceneId]) {
    sceneId = project.activeSceneId || Object.keys(project.scenes)[0] || null
  }
  return { entityId, sceneId }
}

export function restoreProject(
  state: CoreState,
  project: ProjectDoc,
  history: ProjectHistory,
): CoreState {
  if (!state.project) return state
  return {
    ...state,
    project,
    projectDirty: true,
    projectHistory: history,
    selection: reconcileSelection(state, project),
  }
}

export function applyProjectUndo(state: CoreState): CoreState {
  const { past, future } = state.projectHistory ?? emptyProjectHistory()
  if (!state.project || past.length === 0) return state
  const previous = past[past.length - 1]!
  const current = cloneProject(state.project)
  return restoreProject(state, previous, {
    past: past.slice(0, -1),
    future: [current, ...future].slice(0, MAX_PROJECT_HISTORY),
  })
}

export function applyProjectRedo(state: CoreState): CoreState {
  const { past, future } = state.projectHistory ?? emptyProjectHistory()
  if (!state.project || future.length === 0) return state
  const next = future[0]!
  const current = cloneProject(state.project)
  return restoreProject(state, next, {
    past: [...past, current].slice(-MAX_PROJECT_HISTORY),
    future: future.slice(1),
  })
}

const HISTORY_SKIP = new Set<Action['type']>([
  'LOAD_PROJECT',
  'MARK_PROJECT_SAVED',
  'MARK_SCRIPT_SAVED',
  'SELECT_ENTITY',
  'SELECT_SCENE',
  'SET_MODE',
  'SET_AUTHORING_MODE',
  'TOGGLE_CONSOLE',
  'SET_CONSOLE_OPEN',
  'SET_BOTTOM_PANEL_COLLAPSED',
  'SET_DOCK_PANEL_VISIBLE',
  'TOGGLE_DOCK_PANEL',
  'ACKNOWLEDGE_CONSOLE_LOGS',
  'TILESET_EDIT_OPEN',
  'TILESET_EDIT_CLOSE',
  'SET_PLAYING',
  'UPDATE_SCRIPT',
  'OPEN_SCRIPT',
  'UPSERT_SCRIPT',
  'SET_ACTIVE_SCRIPT',
  'LOG',
  'SET_CURSOR',
  'DISMISS_LEGACY_MIGRATE_BANNER',
  'EDITOR_SET_GRID_SIZE',
  'SET_SNAP_TO_GRID',
  'EDITOR_SET_ZOOM',
  'EDITOR_SET_FIT_ZOOM',
  'EDITOR_SET_CAMERA_PREVIEW',
  'EDITOR_SET_PREVIEW_ASSET_LOAD_SCOPE',
  'TILESET_SELECT_CELL',
  'LOGIC_UNDO',
  'LOGIC_REDO',
  'PROJECT_UNDO',
  'PROJECT_REDO',
  'SNAPSHOT_PROJECT_HISTORY',
  'LOGIC_MARK_SCRIPT_SYNCED',
  'LOGIC_MARK_PREVIEW_APPLIED',
  'DIALOG_SET_LIBRARY',
  'DIALOG_SELECT',
  'DIALOG_OPEN_MODAL',
  'DIALOG_CLOSE_MODAL',
  'SPRITESHEET_STUDIO_OPEN',
  'SPRITESHEET_STUDIO_CLOSE',
])

/** True when this action should push a pre-mutation project snapshot. */
export function isHistoryRecordingAction(action: Action): boolean {
  if (HISTORY_SKIP.has(action.type)) return false
  if (action.type === 'UPDATE_ENTITY_TRANSFORM' && action.recordHistory === false) {
    return false
  }
  if (action.type.startsWith('DIALOG_')) return false
  return true
}

export function isUndoRedoAction(action: Action): boolean {
  return (
    action.type === 'PROJECT_UNDO' ||
    action.type === 'PROJECT_REDO' ||
    action.type === 'LOGIC_UNDO' ||
    action.type === 'LOGIC_REDO'
  )
}
