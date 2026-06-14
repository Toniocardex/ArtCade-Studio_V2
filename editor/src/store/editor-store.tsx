import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react'
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
// Granular subscriptions: CoreStateStore + useEditorSelector (useSyncExternalStore)
// and DispatchContext (stable dispatch reference).
//
// State shape, actions, and initial values live in editor-store-state.ts;
// per-domain reducers under store/reducers/.  This file is the React glue.
// ---------------------------------------------------------------------------

import {
  initialCoreState,
  initialVolatileState,
  type CoreState,
  type VolatileState,
  type Action,
} from './editor-store-state'
import { createCoreStateStore, shallowEqual, type CoreStateStore } from './core-state-store'
import { uiReducer }         from './reducers/ui-reducer'
import { projectReducer }    from './reducers/project-reducer'
import { entityReducer }     from './reducers/entity-reducer'
import { objectTypeReducer } from './reducers/object-type-reducer'
import { sceneReducer }      from './reducers/scene-reducer'
import { assetFolderReducer } from './reducers/asset-folder-reducer'
import { logicBoardReducer } from './reducers/logic-board-reducer'
import { dialogReducer } from './reducers/dialog-reducer'
import { layerReducer } from './reducers/layer-reducer'
import { volatileReducer } from './reducers/volatile-reducer'
import { applyAuthoringModeToDocument } from '../utils/authoring-mode'
import { ensureBootSessionReset } from '../utils/boot-session'
import { runLoadProjectSideEffects } from '../utils/project-load-side-effects'
import { TextPromptProvider } from '../components/TextPromptProvider'
import {
  applyProjectRedo,
  applyProjectUndo,
  isHistoryRecordingAction,
  isUndoRedoAction,
  pushProjectHistory,
  projectRevision,
  snapshotProjectHistory,
} from './project-history'

export type { CoreState, VolatileState, Action }
export { shallowEqual }

// ---------------------------------------------------------------------------
// Core reducer — pipe each per-domain reducer.
// ---------------------------------------------------------------------------

export function coreReducer(state: CoreState, action: Action): CoreState {
  if (action.type === 'SNAPSHOT_PROJECT_HISTORY') {
    return snapshotProjectHistory(state)
  }
  if (action.type === 'PROJECT_UNDO' || action.type === 'LOGIC_UNDO') {
    return applyProjectUndo(state)
  }
  if (action.type === 'PROJECT_REDO' || action.type === 'LOGIC_REDO') {
    return applyProjectRedo(state)
  }

  let next = state
  next = uiReducer(next, action)
  next = projectReducer(next, action)
  next = entityReducer(next, action)
  next = objectTypeReducer(next, action)
  next = sceneReducer(next, action)
  next = assetFolderReducer(next, action)
  next = logicBoardReducer(next, action)
  next = dialogReducer(next, action)
  next = layerReducer(next, action)

  if (
    !isUndoRedoAction(action) &&
    isHistoryRecordingAction(action) &&
    state.project &&
    next.project &&
    next !== state &&
    projectRevision(state.project) !== projectRevision(next.project)
  ) {
    const coalesceKey = 'coalesceKey' in action ? action.coalesceKey : undefined
    return pushProjectHistory(state, next, coalesceKey)
  }
  return next
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

const CoreStateStoreContext = createContext<CoreStateStore | null>(null)
const DispatchContext       = createContext<Dispatch<Action> | null>(null)
const CoreContext           = createContext<CoreContextValue | null>(null)
const VolatileContext       = createContext<VolatileContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function EditorProvider({ children }: { children: ReactNode }) {
  const bootResetDone = useRef(false)
  if (!bootResetDone.current) {
    bootResetDone.current = true
    ensureBootSessionReset()
  }

  applyAuthoringModeToDocument(initialCoreState.authoringMode)
  const [coreState,     coreDi]  = useReducer(coreReducer,     initialCoreState)
  const [volatileState, volDi]   = useReducer(volatileReducer, initialVolatileState)
  const coreStore = useRef(createCoreStateStore(initialCoreState))
  const mirroredCoreState = useRef(coreState)
  const needsStoreNotify = useRef(false)

  // Mirror useReducer into the external store before children call getSnapshot.
  if (mirroredCoreState.current !== coreState) {
    mirroredCoreState.current = coreState
    coreStore.current.replaceStateSilent(coreState)
    needsStoreNotify.current = true
  }

  // Notify memoized useEditorSelector subscribers after commit — not during render.
  useLayoutEffect(() => {
    if (!needsStoreNotify.current) return
    needsStoreNotify.current = false
    coreStore.current.notifyListeners()
  })

  const dispatch = useCallback((action: Action) => {
    if (action.type === 'LOAD_PROJECT') {
      runLoadProjectSideEffects(action.path)
    }
    coreDi(action)
    volDi(action)
  }, [coreDi, volDi])

  const coreValue     = useMemo(() => ({ state: coreState,     dispatch }), [coreState,     dispatch])
  const volatileValue = useMemo(() => ({ state: volatileState, dispatch }), [volatileState, dispatch])

  return (
    <CoreStateStoreContext.Provider value={coreStore.current}>
      <DispatchContext.Provider value={dispatch}>
        <CoreContext.Provider value={coreValue}>
          <VolatileContext.Provider value={volatileValue}>
            <TextPromptProvider>
              {children}
            </TextPromptProvider>
          </VolatileContext.Provider>
        </CoreContext.Provider>
      </DispatchContext.Provider>
    </CoreStateStoreContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useEditorDispatch(): Dispatch<Action> {
  const dispatch = useContext(DispatchContext)
  if (!dispatch) throw new Error('useEditorDispatch must be inside EditorProvider')
  return dispatch
}

/** Stable store reference — use getState() in callbacks without subscribing to updates. */
export function useEditorStore(): CoreStateStore {
  const store = useContext(CoreStateStoreContext)
  if (!store) throw new Error('useEditorStore must be inside EditorProvider')
  return store
}

export function useEditorSelector<T>(
  selector: (state: CoreState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const store = useContext(CoreStateStoreContext)
  if (!store) throw new Error('useEditorSelector must be inside EditorProvider')

  const selectorRef = useRef(selector)
  const isEqualRef = useRef(isEqual)
  selectorRef.current = selector
  isEqualRef.current = isEqual

  const snapshotRef = useRef<{ value: T; hasValue: boolean }>({ value: undefined as T, hasValue: false })

  const getSnapshot = useCallback(() => {
    const next = selectorRef.current(store.getState())
    if (snapshotRef.current.hasValue && isEqualRef.current(snapshotRef.current.value, next)) {
      return snapshotRef.current.value
    }
    snapshotRef.current = { value: next, hasValue: true }
    return next
  }, [store])

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}

/**
 * @deprecated Prefer useEditorSelector for reads and useEditorDispatch for actions.
 *
 * Subscribes to the full CoreContext — re-renders on every core state change.
 */
export function useEditor(): CoreContextValue {
  const ctx = useContext(CoreContext)
  if (!ctx) throw new Error('useEditor must be inside EditorProvider')
  return ctx
}

/**
 * useConsoleLogs() — subscribes to VolatileContext (consoleLogs, cursorPos).
 * Re-renders on every log line and mouse move — use only where needed.
 */
export function useConsoleLogs(): VolatileContextValue {
  const ctx = useContext(VolatileContext)
  if (!ctx) throw new Error('useConsoleLogs must be inside EditorProvider')
  return ctx
}
