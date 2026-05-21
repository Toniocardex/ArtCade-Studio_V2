// ---------------------------------------------------------------------------
// reducers/ui-reducer — editor UI state that does NOT live in ProjectDoc
// ---------------------------------------------------------------------------
//
// Selection, active view/tab, play mode, the snap-to-grid toggle and the
// tile brush index are all pure editor state. None of them mark the project
// dirty.

import type { CoreState, Action, DomainReducer } from '../editor-store-state'

export const uiReducer: DomainReducer = (state: CoreState, action: Action) => {
  switch (action.type) {
    case 'SELECT_ENTITY':
      return { ...state, selection: { ...state.selection, entityId: action.entityId } }
    case 'SELECT_SCENE':
      return {
        ...state,
        selection: { ...state.selection, sceneId: action.sceneId, entityId: null },
      }
    case 'SET_MODE':
      return { ...state, mode: action.mode }
    case 'SET_BOTTOM_TAB':
      return { ...state, bottomTab: action.tab }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.playing }
    case 'EDITOR_SET_GRID_SIZE': {
      const rounded = Math.round(action.tileSize)
      const tileSize = Number.isFinite(rounded) ? Math.min(512, Math.max(4, rounded)) : 32
      return state.editorGridSize === tileSize ? state : { ...state, editorGridSize: tileSize }
    }
    case 'SET_SNAP_TO_GRID':
      return state.snapToGrid === action.enabled
        ? state
        : { ...state, snapToGrid: action.enabled }
    case 'EDITOR_SET_ZOOM': {
      // Clamp to a sensible range. 10% is the lowest readable; 400% is the
      // industry-standard upper bound for 2D editors (Photoshop, Aseprite).
      const clamped = Math.min(4.0, Math.max(0.1, action.zoom))
      // Snap to 3 decimals so floating-point drift from wheel-zoom never
      // produces "99.9999%" labels in the toolbar.
      const next = Math.round(clamped * 1000) / 1000
      return state.editorZoom === next ? state : { ...state, editorZoom: next }
    }
    case 'EDITOR_SET_CAMERA_PREVIEW':
      return state.cameraPreview === action.enabled
        ? state
        : { ...state, cameraPreview: action.enabled }
    case 'TILESET_SELECT_CELL':
      return { ...state, selectedTileCell: Math.max(0, action.cellIndex) }
    default:
      return state
  }
}
