// ---------------------------------------------------------------------------
// editor-store-state — type definitions + initial values for the store
// ---------------------------------------------------------------------------
//
// Kept in a separate file from editor-store.tsx so that per-domain reducers
// in editor/src/store/reducers/ can import these types without creating a
// cycle with the provider module.

import type { AuthoringMode } from '../types/authoring-mode'
import { readStoredAuthoringMode } from '../utils/authoring-mode'
import type {
  EditorView,
  ScriptFile, ProjectDoc, ConsoleEntry,
  LogicBoard, LogicEvent, ComponentKey, WorldSettings, TilesetAsset, ImageAsset,
  SpriteComponent, PhysicsComponent, Vec3, AssetFolderCategory,
} from '../types'
import type { DialogScript } from '../utils/dialog/dialog-script'
import type { InspectorAssetSelection } from '../types/inspector-selection'
import { DEFAULT_EDITOR_ACTIVE_LAYER } from '../constants/scene-layers'
import {
  EDITOR_BOOT_ZOOM, DEFAULT_EDITOR_GRID_SIZE,
} from '../constants/editor-viewport'
import type { DockPanelId, DockPanelVisibility } from '../constants/dock-panels'
import { readStoredDockPanelVisibility } from '../utils/dock-panel-visibility'
import { createInitialDockUiSlice } from '../utils/dock-ui-state'
import { readEditorPreferences } from '../utils/editor-preferences'

// ---- Core state (stable) ---------------------------------------------------

export interface CoreState {
  project:          ProjectDoc | null
  projectPath:      string | null
  projectDirty:     boolean
  selection:        { entityId: number | null; sceneId: string | null }
  /** Asset-driven inspector (Project Explorer); cleared when an entity is selected. */
  inspectorAsset:   InspectorAssetSelection | null
  /** Layer row selected in Scene Layers panel (UI-only until layer model ships). */
  inspectorLayerName: string | null
  /** Active layer for canvas toolbar (UI-only until layer model ships). */
  editorActiveLayer: string
  /** Per-entity display layer in inspector (UI-only). */
  entityDisplayLayers: Record<number, string>
  mode:             EditorView
  /** True when the bottom dock is expanded and the console panel is visible. */
  consoleOpen:           boolean
  bottomPanelCollapsed:  boolean
  /** Per-panel visibility for the bottom dock (persisted in localStorage). */
  dockPanelVisibility:   DockPanelVisibility
  /** Last console log id acknowledged while the console dock was visible. */
  consoleAckUpToId:      number
  /** When non-null, swap the canvas viewport for the TilesetEditorPanel
   *  (sub-view of mode='canvas'). Set by clicking a tileset in AssetBrowser,
   *  cleared by the "← Canvas" back button or by LOAD_PROJECT. */
  editingTilesetId: string | null
  openScripts:      ScriptFile[]
  activeScriptPath: string | null
  isPlaying:        boolean
  selectedTileCell: number   // Phase F: brush cell id (1-based, 0 = eraser)
  // Editor-only chrome (not persisted in ProjectDoc). These are REQUIRED so
  // consumers don't need `?? default` everywhere — the reducer / project
  // loader is responsible for keeping them populated.
  editorGridSize:   number
  snapToGrid:       boolean
  editorGuidesVisible: boolean
  editorZoom:       number   // visual zoom (CSS transform), see constants/editor-viewport
  /**
   * 'fit'    → zoom auto-tracks the panel size: any panel resize / scene
   *            size change recomputes editorZoom so the whole scene stays
   *            centred and fully visible. This is the default after every
   *            project load (and on initial boot) — it solves the "100%
   *            doesn't fit the panel" UX issue exactly the way Figma /
   *            Aseprite / Affinity Designer do.
   * 'manual' → zoom is whatever the user picked (preset, +/-, wheel, typed
   *            number, Ctrl+0). Panel resizes no longer move it.
   *
   * Any explicit zoom dispatch flips this back to 'manual'. The dedicated
   * EDITOR_SET_FIT_ZOOM action is the only one that keeps the mode in 'fit'.
   */
  editorZoomMode:   'fit' | 'manual'
  cameraPreview:    boolean  // when true the canvas is clipped to viewportSize (no PLAY needed)
  /**
   * Bumped every time LOAD_PROJECT fires. Reserved for "fresh load" signals
   * that pure project-reference comparisons can't express (entity edits
   * mutate the project reference too). No active consumers right now — the
   * previous auto-fit hook was retired when fit-mode + ResizeObserver took
   * over — but the counter is cheap and useful for future hooks (telemetry,
   * runtime reset, etc.).
   */
  projectLoadEpoch: number
  /** True once after opening a legacy project upgraded to format v2 in memory. */
  legacyMigrateBanner?: boolean
  /** UI presentation tier: guidance/density only (see LOGIC_BOARD_UX_CHARTER). */
  authoringMode: AuthoringMode
  /** Dialog scripts keyed by dialogId (persisted as dialogs/*.json). */
  dialogs: Record<string, DialogScript>
  selectedDialogId: string | null
  dialogModal: { open: boolean; dialogId: string | null }
  /** Spritesheet Studio modal — edits ImageAsset.clips (runtime-ready). */
  spritesheetStudio: { open: boolean; imageAssetId: string | null }
  /** Undo/redo snapshots for the full ProjectDoc (unified editor history). */
  projectHistory: ProjectHistory
  /** Last `logicBoardsRevision` written to main script via auto-sync / Apply. */
  logicScriptSyncedRevision: string | null
  /** Last `logicBoardsRevision` hot-reloaded into the WASM preview runtime. */
  logicPreviewAppliedRevision: string | null
  /**
   * Preview WASM texture/audio closure scope (see collect-scene-asset-refs).
   * `scene+spawn-prototypes` preloads sprites for spawnEntity prototype classes.
   */
  previewAssetLoadScope: 'scene-static' | 'scene+spawn-prototypes'
  /** Canvas-only chromeless mode (F11); session-only, not persisted. */
  focusMode: boolean
  /** Disables tier/focus CSS transitions (persisted per user). */
  reduceMotion: boolean
}

export type ProjectHistory = {
  past: ProjectDoc[]
  future: ProjectDoc[]
}

// ---- Volatile state (high-frequency) ---------------------------------------

export interface VolatileState {
  consoleLogs: ConsoleEntry[]
  cursorPos:   { x: number; y: number }
}

// ---- Actions ---------------------------------------------------------------

export type Action =
  | { type: 'SELECT_ENTITY';     entityId: number | null }
  | { type: 'SELECT_SCENE';      sceneId: string }
  | { type: 'SELECT_INSPECTOR_ASSET'; asset: InspectorAssetSelection | null }
  | { type: 'SELECT_INSPECTOR_LAYER'; layerName: string | null }
  | { type: 'SET_EDITOR_ACTIVE_LAYER'; layerName: string }
  | { type: 'ENTITY_SET_DISPLAY_LAYER'; entityId: number; layerName: string }
  | { type: 'SET_MODE';          mode: EditorView }
  | { type: 'TOGGLE_FOCUS_MODE' }
  | { type: 'SET_FOCUS_MODE';    enabled: boolean }
  | { type: 'SET_REDUCE_MOTION'; enabled: boolean }
  | { type: 'SET_AUTHORING_MODE'; mode: AuthoringMode }
  | { type: 'TOGGLE_CONSOLE' }
  | { type: 'SET_CONSOLE_OPEN';  open: boolean }
  | { type: 'SET_BOTTOM_PANEL_COLLAPSED'; collapsed: boolean }
  | { type: 'SET_DOCK_PANEL_VISIBLE'; panel: DockPanelId; visible: boolean }
  | { type: 'TOGGLE_DOCK_PANEL'; panel: DockPanelId }
  | { type: 'ACKNOWLEDGE_CONSOLE_LOGS'; upToId: number }
  | { type: 'TILESET_EDIT_OPEN'; tilesetId: string }
  | { type: 'TILESET_EDIT_CLOSE' }
  | { type: 'SET_PLAYING';       playing: boolean }
  | { type: 'UPDATE_SCRIPT';     path: string; content: string }
  | { type: 'OPEN_SCRIPT';       file: ScriptFile }
  /** Add or update script buffer without switching editor mode (Logic Board sync). */
  | { type: 'UPSERT_SCRIPT';    path: string; content: string; isDirty?: boolean; activate?: boolean }
  | { type: 'SET_ACTIVE_SCRIPT'; path: string }
  | { type: 'LOG';               entry: ConsoleEntry }
  | { type: 'SET_CURSOR';        x: number; y: number }
  | {
      type: 'LOAD_PROJECT'
      project: ProjectDoc
      path: string
      migratedFromLegacy?: boolean
      dialogs?: Record<string, DialogScript>
      selectedDialogId?: string | null
    }
  | { type: 'DISMISS_LEGACY_MIGRATE_BANNER' }
  | { type: 'PROJECT_RENAME';    name: string }
  | { type: 'MARK_PROJECT_SAVED' }
  | { type: 'MARK_SCRIPT_SAVED'; path: string }
  | {
      type: 'UPDATE_ENTITY_TRANSFORM'
      entityId: number
      x: number
      y: number
      rotation: number
      scaleX: number
      scaleY: number
      /** When false, skip undo snapshot (e.g. live canvas drag). Default: record. */
      recordHistory?: boolean
    }
  | { type: 'SNAPSHOT_PROJECT_HISTORY' }
  | { type: 'PROJECT_UNDO' }
  | { type: 'PROJECT_REDO' }
  | { type: 'ENTITY_SET_SPRITE';       entityId: number; sprite: SpriteComponent }
  | { type: 'ENTITY_SET_SPRITE_FILL';  entityId: number; fillColor: Vec3 }
  | { type: 'ENTITY_SET_PHYSICS';      entityId: number; physics: PhysicsComponent }
  | { type: 'ENTITY_REMOVE_PHYSICS';   entityId: number }
  | { type: 'ENTITY_SET_COMPONENT';    entityId: number; key: ComponentKey; value: object }
  | { type: 'ENTITY_REMOVE_COMPONENT'; entityId: number; key: ComponentKey }
  | { type: 'OBJECT_TYPE_ADD';   displayName: string }
  | { type: 'INSTANCE_ADD_FROM_TYPE'; sceneId: string; objectTypeId: string }
  | { type: 'INSTANCE_DUPLICATE'; instanceId: number; sceneId: string }
  | { type: 'ENTITY_DELETE';     entityId: number }
  | { type: 'ENTITY_SET_VISIBLE'; entityId: number; visible: boolean }
  | { type: 'ENTITY_SET_NAME';    entityId: number; name: string }
  | { type: 'ENTITY_SET_CLASSNAME'; entityId: number; className: string }
  | { type: 'ENTITY_ADD_TAG';     entityId: number; tag: string }
  | { type: 'ENTITY_REMOVE_TAG'; entityId: number; tag: string }
  | { type: 'WORLD_SET';         patch: Partial<WorldSettings> }
  | { type: 'SCENE_ADD_EMPTY'; sourceSceneId?: string; name?: string }
  | { type: 'SCENE_RENAME';    sceneId: string; name: string }
  | { type: 'SCENE_SET_START'; sceneId: string }
  | { type: 'SCENE_DELETE';    sceneId: string }
  | { type: 'SCENE_DUPLICATE'; sceneId: string }
  | { type: 'OBJECT_TYPE_RENAME'; objectTypeId: string; displayName: string }
  | { type: 'OBJECT_TYPE_DELETE'; objectTypeId: string }
  | { type: 'PROJECT_NORMALIZE_ASSET_REFS' }
  | { type: 'ASSET_FOLDER_CREATE'; category: AssetFolderCategory; name: string }
  | { type: 'ASSET_MOVE_TO_FOLDER'; folderId: string; assetType: 'image' | 'audio' | 'font' | 'tileset'; assetId: string }
  | { type: 'ASSET_UNASSIGN_FROM_FOLDERS'; assetType: 'image' | 'audio' | 'font' | 'tileset'; assetId: string }
  | { type: 'ASSET_FOLDER_DELETE'; folderId: string }
  | { type: 'SCENE_SET_WORLD_SIZE'; sceneId: string; x: number; y: number }
  | { type: 'SCENE_SET_VIEWPORT_SIZE'; sceneId: string; x: number; y: number }
  | { type: 'EDITOR_SET_GRID_SIZE'; tileSize: number }
  | { type: 'SET_SNAP_TO_GRID'; enabled: boolean }
  | { type: 'TOGGLE_EDITOR_GUIDES' }
  | { type: 'EDITOR_SET_ZOOM'; zoom: number }
  /** Used by fit-to-panel: applies the zoom AND keeps editorZoomMode = 'fit'. */
  | { type: 'EDITOR_SET_FIT_ZOOM'; zoom: number }
  | { type: 'EDITOR_SET_CAMERA_PREVIEW'; enabled: boolean }
  | { type: 'EDITOR_SET_PREVIEW_ASSET_LOAD_SCOPE'; scope: 'scene-static' | 'scene+spawn-prototypes' }
  | { type: 'TILEMAP_INIT';  sceneId: string }
  | { type: 'TILEMAP_PAINT'; sceneId: string; index: number; tileId: number }
  | { type: 'TILEMAP_PAINT_CELL'; sceneId: string; col: number; row: number; tileId: number }
  | { type: 'TILESET_ASSET_ADD';     asset: TilesetAsset }
  | { type: 'TILESET_ASSET_REMOVE';  assetId: string }
  | { type: 'ASSET_ADD';             asset: ImageAsset }
  | { type: 'ASSET_REMOVE';          assetId: string }
  | { type: 'AUDIO_ASSET_ADD';       asset: import('../types/index').AudioAsset }
  | { type: 'AUDIO_ASSET_REMOVE';    assetId: string }
  | { type: 'FONT_ASSET_ADD';        asset: import('../types/index').FontAsset }
  | { type: 'FONT_ASSET_REMOVE';     assetId: string }
  | { type: 'TILEMAP_SET_TILESETID'; sceneId: string; assetId: string }
  | { type: 'TILESET_SELECT_CELL';   cellIndex: number }
  // ---- Logic Board CRUD (all operate on project.logicBoards) ----
  | { type: 'LOGIC_ADD_BOARD';    board: LogicBoard }
  | { type: 'LOGIC_RENAME_BOARD'; boardId: string; name: string }
  | { type: 'LOGIC_DELETE_BOARD'; boardId: string }
  | { type: 'LOGIC_ADD_EVENT';    boardId: string; event: LogicEvent }
  | { type: 'LOGIC_INSERT_EVENT'; boardId: string; event: LogicEvent; afterEventId?: string }
  | { type: 'LOGIC_UPDATE_EVENT'; boardId: string; event: LogicEvent }
  | { type: 'LOGIC_DELETE_EVENT'; boardId: string; eventId: string }
  | { type: 'LOGIC_MOVE_EVENT'; boardId: string; eventId: string; toIndex: number }
  | { type: 'LOGIC_UNDO' }
  | { type: 'LOGIC_REDO' }
  | { type: 'LOGIC_MARK_SCRIPT_SYNCED'; revision: string }
  | { type: 'LOGIC_MARK_PREVIEW_APPLIED'; revision: string }
  | { type: 'DIALOG_SET_LIBRARY'; dialogs: Record<string, DialogScript>; selectedDialogId?: string | null }
  | { type: 'DIALOG_SELECT'; dialogId: string | null }
  | { type: 'DIALOG_UPSERT'; script: DialogScript }
  | { type: 'DIALOG_CREATE'; dialogId: string }
  | { type: 'DIALOG_DELETE'; dialogId: string }
  | { type: 'DIALOG_RENAME'; fromId: string; toId: string }
  | { type: 'DIALOG_OPEN_MODAL'; dialogId: string }
  | { type: 'DIALOG_CLOSE_MODAL' }
  | { type: 'SPRITESHEET_STUDIO_OPEN'; imageAssetId: string }
  | { type: 'SPRITESHEET_STUDIO_CLOSE' }

export type DomainReducer = (state: CoreState, action: Action) => CoreState

export const INITIAL_LOGS: ConsoleEntry[] = []

const initialDockUi = createInitialDockUiSlice(readStoredDockPanelVisibility())
const initialEditorPrefs = readEditorPreferences()

/** Boot state: no project until the user creates or opens one (File menu). */
export const initialCoreState: CoreState = {
  project:          null,
  projectPath:      null,
  projectDirty:     false,
  selection:        { entityId: null, sceneId: null },
  inspectorAsset:   null,
  inspectorLayerName: null,
  editorActiveLayer: DEFAULT_EDITOR_ACTIVE_LAYER,
  entityDisplayLayers: {},
  mode:             'canvas',
  consoleOpen:           initialDockUi.consoleOpen,
  bottomPanelCollapsed:  initialDockUi.bottomPanelCollapsed,
  dockPanelVisibility:   initialDockUi.dockPanelVisibility,
  consoleAckUpToId:      0,
  editingTilesetId: null,
  openScripts:      [],
  activeScriptPath: null,
  isPlaying:        false,
  selectedTileCell: 1,
  editorGridSize:   DEFAULT_EDITOR_GRID_SIZE,
  snapToGrid:       false,
  editorGuidesVisible: true,
  editorZoom:       EDITOR_BOOT_ZOOM,
  editorZoomMode:   'manual',
  cameraPreview:    false,
  projectLoadEpoch: 0,
  authoringMode: readStoredAuthoringMode(),
  dialogs: {},
  selectedDialogId: null,
  dialogModal: { open: false, dialogId: null },
  spritesheetStudio: { open: false, imageAssetId: null },
  projectHistory: { past: [], future: [] },
  logicScriptSyncedRevision: null,
  logicPreviewAppliedRevision: null,
  previewAssetLoadScope: 'scene-static',
  focusMode: false,
  reduceMotion: initialEditorPrefs.reduceMotion,
}

export const initialVolatileState: VolatileState = {
  consoleLogs: INITIAL_LOGS,
  cursorPos:   { x: 0, y: 0 },
}
