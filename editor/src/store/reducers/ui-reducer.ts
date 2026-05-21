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
    case 'TILESET_SELECT_CELL':
      return { ...state, selectedTileCell: Math.max(0, action.cellIndex) }
    default:
      return state
  }
}
