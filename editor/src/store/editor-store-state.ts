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
  SpriteComponent, PhysicsComponent, Vec3,
} from '../types'
import {
  EDITOR_BOOT_ZOOM, DEFAULT_EDITOR_GRID_SIZE,
} from '../constants/editor-viewport'

// ---- Core state (stable) ---------------------------------------------------

export interface CoreState {
  project:          ProjectDoc | null
  projectPath:      string | null
  projectDirty:     boolean
  selection:        { entityId: number | null; sceneId: string | null }
  mode:             EditorView
  /** True when bottom dock shows the Console tab expanded (derived from tab + collapse). */
  consoleOpen:           boolean
  bottomPanelTab:        'assets' | 'console'
  bottomPanelCollapsed:  boolean
  /** Last console log id acknowledged while the Console tab was visible. */
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
  /** UI presentation tier: guidance/density only (see LOGIC_BOARD_UX_CHARTER). */
  authoringMode: AuthoringMode
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
  | { type: 'SET_MODE';          mode: EditorView }
  | { type: 'SET_AUTHORING_MODE'; mode: AuthoringMode }
  | { type: 'TOGGLE_CONSOLE' }
  | { type: 'SET_CONSOLE_OPEN';  open: boolean }
  | { type: 'SET_BOTTOM_PANEL_TAB'; tab: 'assets' | 'console' }
  | { type: 'SET_BOTTOM_PANEL_COLLAPSED'; collapsed: boolean }
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
  | { type: 'LOAD_PROJECT';      project: ProjectDoc; path: string }
  | { type: 'PROJECT_RENAME';    name: string }
  | { type: 'MARK_PROJECT_SAVED' }
  | { type: 'MARK_SCRIPT_SAVED'; path: string }
  | { type: 'UPDATE_ENTITY_TRANSFORM'; entityId: number; x: number; y: number; rotation: number; scaleX: number; scaleY: number }
  | { type: 'ENTITY_SET_SPRITE';       entityId: number; sprite: SpriteComponent }
  | { type: 'ENTITY_SET_SPRITE_FILL';  entityId: number; fillColor: Vec3 }
  | { type: 'ENTITY_SET_PHYSICS';      entityId: number; physics: PhysicsComponent }
  | { type: 'ENTITY_REMOVE_PHYSICS';   entityId: number }
  | { type: 'ENTITY_SET_COMPONENT';    entityId: number; key: ComponentKey; value: object }
  | { type: 'ENTITY_REMOVE_COMPONENT'; entityId: number; key: ComponentKey }
  | { type: 'ENTITY_ADD';        sceneId: string }
  | { type: 'ENTITY_DUPLICATE';  entityId: number; sceneId: string }
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
  | { type: 'SCENE_SET_WORLD_SIZE'; sceneId: string; x: number; y: number }
  | { type: 'SCENE_SET_VIEWPORT_SIZE'; sceneId: string; x: number; y: number }
  | { type: 'EDITOR_SET_GRID_SIZE'; tileSize: number }
  | { type: 'SET_SNAP_TO_GRID'; enabled: boolean }
  | { type: 'EDITOR_SET_ZOOM'; zoom: number }
  /** Used by fit-to-panel: applies the zoom AND keeps editorZoomMode = 'fit'. */
  | { type: 'EDITOR_SET_FIT_ZOOM'; zoom: number }
  | { type: 'EDITOR_SET_CAMERA_PREVIEW'; enabled: boolean }
  | { type: 'TILEMAP_INIT';  sceneId: string }
  | { type: 'TILEMAP_PAINT'; sceneId: string; index: number; tileId: number }
  | { type: 'TILEMAP_PAINT_CELL'; sceneId: string; col: number; row: number; tileId: number }
  | { type: 'TILESET_ASSET_ADD';     asset: TilesetAsset }
  | { type: 'TILESET_ASSET_REMOVE';  assetId: string }
  | { type: 'ASSET_ADD';             asset: ImageAsset }
  | { type: 'ASSET_REMOVE';          assetId: string }
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

export type DomainReducer = (state: CoreState, action: Action) => CoreState

export const INITIAL_LOGS: ConsoleEntry[] = []

/** Boot state: no project until the user creates or opens one (File menu). */
export const initialCoreState: CoreState = {
  project:          null,
  projectPath:      null,
  projectDirty:     false,
  selection:        { entityId: null, sceneId: null },
  mode:             'canvas',
  consoleOpen:           false,
  bottomPanelTab:        'assets',
  bottomPanelCollapsed:  false,
  consoleAckUpToId:      0,
  editingTilesetId: null,
  openScripts:      [],
  activeScriptPath: null,
  isPlaying:        false,
  selectedTileCell: 1,
  editorGridSize:   DEFAULT_EDITOR_GRID_SIZE,
  snapToGrid:       false,
  editorZoom:       EDITOR_BOOT_ZOOM,
  editorZoomMode:   'manual',
  cameraPreview:    false,
  projectLoadEpoch: 0,
  authoringMode: readStoredAuthoringMode(),
}

export const initialVolatileState: VolatileState = {
  consoleLogs: INITIAL_LOGS,
  cursorPos:   { x: 0, y: 0 },
}
