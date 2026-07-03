import type { Action } from './editor-store-state'

export type ActionFamily = 'authoring' | 'workspace' | 'runtime' | 'volatile'

export const AUTHORING_ACTION_TYPES = [
  'PROJECT_RENAME',
  'PROJECT_VARIABLES_SET',
  'UPDATE_ENTITY_TRANSFORM',
  'PROJECT_UNDO',
  'PROJECT_REDO',
  'LOGIC_UNDO',
  'LOGIC_REDO',
  'ENTITY_SET_SPRITE',
  'ENTITY_SET_SPRITE_FILL',
  'ENTITY_SET_PHYSICS',
  'ENTITY_REMOVE_PHYSICS',
  'ENTITY_SET_COMPONENT',
  'ENTITY_REMOVE_COMPONENT',
  'OBJECT_TYPE_ADD',
  'INSTANCE_ADD_FROM_TYPE',
  'INSTANCE_DUPLICATE',
  'ENTITY_DELETE',
  'ENTITY_SET_VISIBLE',
  'ENTITY_SET_NAME',
  'ENTITY_SET_CLASSNAME',
  'ENTITY_ADD_TAG',
  'ENTITY_REMOVE_TAG',
  'WORLD_SET',
  'SCENE_ADD_EMPTY',
  'SCENE_RENAME',
  'SCENE_SET_START',
  'SCENE_DELETE',
  'SCENE_DUPLICATE',
  'OBJECT_TYPE_RENAME',
  'OBJECT_TYPE_VARIABLES_SET',
  'INSTANCE_VARIABLE_OVERRIDES_SET',
  'OBJECT_TYPE_DELETE',
  'PROJECT_NORMALIZE_ASSET_REFS',
  'ASSET_FOLDER_CREATE',
  'ASSET_FOLDER_RENAME',
  'ASSET_MOVE_TO_FOLDER',
  'ASSET_UNASSIGN_FROM_FOLDERS',
  'ASSET_FOLDER_DELETE',
  'SCENE_SET_WORLD_SIZE',
  'SCENE_SET_VIEWPORT_SIZE',
  'TILEMAP_INIT',
  'TILEMAP_PAINT',
  'TILEMAP_PAINT_CELL',
  'TILESET_ASSET_ADD',
  'TILESET_ASSET_REMOVE',
  'ASSET_ADD',
  'IMAGE_ASSET_SET_CLIPS',
  'ASSET_REMOVE',
  'AUDIO_ASSET_ADD',
  'AUDIO_ASSET_REMOVE',
  'FONT_ASSET_ADD',
  'FONT_ASSET_REMOVE',
  'TILEMAP_SET_TILESETID',
  'TILEMAP_SET_TILESIZE',
  'LOGIC_ADD_BOARD',
  'LOGIC_RENAME_BOARD',
  'LOGIC_DELETE_BOARD',
  'LOGIC_ADD_EVENT',
  'LOGIC_INSERT_EVENT',
  'LOGIC_UPDATE_EVENT',
  'LOGIC_DELETE_EVENT',
  'LOGIC_MOVE_EVENT',
  'DIALOG_SET_LIBRARY',
  'DIALOG_UPSERT',
  'DIALOG_CREATE',
  'DIALOG_DELETE',
  'DIALOG_RENAME',
  'LAYER_ADD',
  'LAYER_RENAME',
  'LAYER_DELETE',
  'LAYER_MOVE',
] as const satisfies readonly Action['type'][]

export const WORKSPACE_ACTION_TYPES = [
  'SELECT_ENTITY',
  'SELECT_SCENE',
  'SELECT_INSPECTOR_ASSET',
  'SELECT_INSPECTOR_LAYER',
  'SET_EDITOR_ACTIVE_LAYER',
  'ENTITY_SET_DISPLAY_LAYER',
  'SET_MODE',
  'TOGGLE_FOCUS_MODE',
  'SET_FOCUS_MODE',
  'SET_REDUCE_MOTION',
  'SET_AUTHORING_MODE',
  'TOGGLE_CONSOLE',
  'SET_CONSOLE_OPEN',
  'SET_BOTTOM_PANEL_COLLAPSED',
  'SET_DOCK_PANEL_VISIBLE',
  'TOGGLE_DOCK_PANEL',
  'ACKNOWLEDGE_CONSOLE_LOGS',
  'TILESET_PAINT_BEGIN',
  'TILESET_PAINT_END',
  'TILESET_TOGGLE_PALETTE',
  'DISMISS_PAINT_SOURCE_NOTICE',
  'TILESET_EDIT_OPEN',
  'TILESET_EDIT_CLOSE',
  'UPDATE_SCRIPT',
  'OPEN_SCRIPT',
  'UPSERT_SCRIPT',
  'SET_ACTIVE_SCRIPT',
  'SET_MAIN_SCRIPT_VIEW',
  'LOAD_PROJECT',
  'DISMISS_LEGACY_MIGRATE_BANNER',
  'MARK_PROJECT_SAVED',
  'MARK_SCRIPT_SAVED',
  'SNAPSHOT_PROJECT_HISTORY',
  'EDITOR_SET_GRID_SIZE',
  'EDITOR_SET_RULER_STEP',
  'SET_RULERS_VISIBLE',
  'SET_SNAP_TO_GRID',
  'TOGGLE_EDITOR_GUIDES',
  'EDITOR_SET_ZOOM',
  'EDITOR_SET_FIT_ZOOM',
  'EDITOR_SET_CAMERA_PREVIEW',
  'TILESET_SELECT_CELL',
  'DIALOG_SELECT',
  'DIALOG_OPEN_MODAL',
  'DIALOG_CLOSE_MODAL',
  'SPRITESHEET_STUDIO_OPEN',
  'SPRITESHEET_STUDIO_CLOSE',
] as const satisfies readonly Action['type'][]

export const RUNTIME_ACTION_TYPES = [
  'SET_PLAYING',
  'LOGIC_MARK_PREVIEW_APPLIED',
] as const satisfies readonly Action['type'][]

export const VOLATILE_ACTION_TYPES = [
  'LOG',
  'SET_CURSOR',
] as const satisfies readonly Action['type'][]

type ClassifiedActionType =
  | typeof AUTHORING_ACTION_TYPES[number]
  | typeof WORKSPACE_ACTION_TYPES[number]
  | typeof RUNTIME_ACTION_TYPES[number]
  | typeof VOLATILE_ACTION_TYPES[number]

type MissingActionTypes = Exclude<Action['type'], ClassifiedActionType>
type UnknownClassifiedActionTypes = Exclude<ClassifiedActionType, Action['type']>
type AssertNever<T extends never> = T

export type AllActionsAreClassified = AssertNever<MissingActionTypes>
export type OnlyKnownActionsAreClassified = AssertNever<UnknownClassifiedActionTypes>

const ACTION_FAMILY_ENTRIES: Array<readonly [readonly Action['type'][], ActionFamily]> = [
  [AUTHORING_ACTION_TYPES, 'authoring'],
  [WORKSPACE_ACTION_TYPES, 'workspace'],
  [RUNTIME_ACTION_TYPES, 'runtime'],
  [VOLATILE_ACTION_TYPES, 'volatile'],
]

export const ACTION_FAMILY_BY_TYPE: Readonly<Record<Action['type'], ActionFamily>> = Object.freeze(
  ACTION_FAMILY_ENTRIES.reduce((acc, [types, family]) => {
    for (const type of types) acc[type] = family
    return acc
  }, {} as Record<Action['type'], ActionFamily>),
)

export function getActionFamily(type: Action['type']): ActionFamily {
  return ACTION_FAMILY_BY_TYPE[type]
}

export type AuthoringActionType = typeof AUTHORING_ACTION_TYPES[number]
export type WorkspaceActionType = typeof WORKSPACE_ACTION_TYPES[number]
export type RuntimeActionType = typeof RUNTIME_ACTION_TYPES[number]
export type VolatileActionType = typeof VOLATILE_ACTION_TYPES[number]

export type AuthoringAction = Extract<Action, { type: AuthoringActionType }>
export type WorkspaceAction = Extract<Action, { type: WorkspaceActionType }>
export type RuntimeAction = Extract<Action, { type: RuntimeActionType }>
export type VolatileAction = Extract<Action, { type: VolatileActionType }>
