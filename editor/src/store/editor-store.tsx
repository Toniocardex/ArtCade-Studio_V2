import { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
import type { ReactNode, Dispatch } from 'react'

// ---------------------------------------------------------------------------
// State split:
//   CoreState    — project, selection, scripts, play-mode (changes rarely)
//   VolatileState — consoleLogs, cursorPos (changes every frame / every log)
//
// WHY: all useContext() consumers re-render when their context value changes.
// PreviewPanel must NOT re-render on every debug.log() from Lua, otherwise
// React reconciliation runs during Emscripten's rAF callback -> WebGL
// compositing glitch visible as a one-frame flash when entities are
// destroyed.
//
// State shape, actions, and initial values live in editor-store-state.ts;
// per-domain reducers under store/reducers/.  This
// file is just the React glue.
// ---------------------------------------------------------------------------

import {
  initialCoreState,
  initialVolatileState,
  type CoreState,
  type VolatileState,
  type Action,
} from './editor-store-state'
import { uiReducer }         from './reducers/ui-reducer'
import { projectReducer }    from './reducers/project-reducer'
import { entityReducer }     from './reducers/entity-reducer'
import { objectTypeReducer } from './reducers/object-type-reducer'
import { sceneReducer }      from './reducers/scene-reducer'
import { logicBoardReducer } from './reducers/logic-board-reducer'
import { dialogReducer } from './reducers/dialog-reducer'
import { applyAuthoringModeToDocument } from '../utils/authoring-mode'

export type { CoreState, VolatileState, Action }

// ---------------------------------------------------------------------------
// Core reducer — pipe each per-domain reducer.
//
// Every domain reducer returns the input state by reference for actions it
// does not own, so a single dispatch costs N function calls but at most one
// state allocation.
// ---------------------------------------------------------------------------

export function coreReducer(state: CoreState, action: Action): CoreState {
  let next = state
  next = uiReducer(next, action)
  next = projectReducer(next, action)
  next = entityReducer(next, action)
  next = objectTypeReducer(next, action)
  next = sceneReducer(next, action)
  next = logicBoardReducer(next, action)
  next = dialogReducer(next, action)
  return next
}

// ---------------------------------------------------------------------------
// Volatile reducer — handles logs and cursor; ignores everything else
// ---------------------------------------------------------------------------

function volatileReducer(state: VolatileState, action: Action): VolatileState {
  switch (action.type) {
    case 'LOG':
      return { ...state, consoleLogs: [...state.consoleLogs, action.entry] }
    case 'SET_CURSOR':
      return { ...state, cursorPos: { x: action.x, y: action.y } }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

interface CoreContextValue {
  state:    CoreState
  dispatch: Dispatch<Action>
}

interface VolatileContextValue {
  state:    VolatileState
  dispatch: Dispatch<Action>
}

const CoreContext     = createContext<CoreContextValue | null>(null)
const VolatileContext = createContext<VolatileContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function EditorProvider({ children }: { children: ReactNode }) {
  applyAuthoringModeToDocument(initialCoreState.authoringMode)
  const [coreState,     coreDi]  = useReducer(coreReducer,     initialCoreState)
  const [volatileState, volDi]   = useReducer(volatileReducer, initialVolatileState)

  // Single stable dispatch that fans out to both reducers.
  // Wrapped in useCallback so its reference never changes -> contexts that
  // receive it as a dep (useMemo below) won't needlessly re-create their
  // value.
  const dispatch = useCallback((action: Action) => {
    coreDi(action)
    volDi(action)
  }, [coreDi, volDi])

  // Memoize context values so reference only changes when the respective
  // state slice changes. PreviewPanel consumes CoreContext only -> it will
  // NOT re-render when consoleLogs or cursorPos change.
  const coreValue     = useMemo(() => ({ state: coreState,     dispatch }), [coreState,     dispatch])
  const volatileValue = useMemo(() => ({ state: volatileState, dispatch }), [volatileState, dispatch])

  return (
    <CoreContext.Provider value={coreValue}>
      <VolatileContext.Provider value={volatileValue}>
        {children}
      </VolatileContext.Provider>
    </CoreContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * useEditor() — subscribes to CoreContext (project, selection, mode, scripts).
 * Does NOT re-render when consoleLogs or cursorPos change.
 * Use for: PreviewPanel, SceneObjectsPanel, InspectorPanel, ScriptEditor,
 * MenuBar, etc.
 */
export function useEditor(): CoreContextValue {
  const ctx = useContext(CoreContext)
  if (!ctx) throw new Error('useEditor must be inside EditorProvider')
  return ctx
}

/**
 * useConsoleLogs() — subscribes to VolatileContext (consoleLogs, cursorPos).
 * Re-renders on every log line and mouse move — use only where needed.
 * Use for: ConsolePanel, StatusBar.
 */
export function useConsoleLogs(): VolatileContextValue {
  const ctx = useContext(VolatileContext)
  if (!ctx) throw new Error('useConsoleLogs must be inside EditorProvider')
  return ctx
}
