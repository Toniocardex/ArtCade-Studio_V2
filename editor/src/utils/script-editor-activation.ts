import type { Action, CoreState } from '../store/editor-store-state'
import { openProjectScript } from './open-project-script'

export type ResolveOpenScriptEditorPathOptions = Readonly<{
  /** When true, prefer the selected entity script over the current tab. */
  preferSelection?: boolean
}>

function openScriptPaths(state: CoreState): Set<string> {
  return new Set(state.openScripts.map((script) => script.path))
}

function entityOpenScriptPath(state: CoreState): string | null {
  if (!state.project) return null
  const entityId = state.selection.entityId
  if (entityId == null) return null
  const entityScript = state.project.entities?.[entityId]?.scriptPath?.trim()
  if (!entityScript) return null
  return openScriptPaths(state).has(entityScript) ? entityScript : null
}

/**
 * Picks the script tab to show when entering Script Editor mode.
 * Only returns paths that are already present in openScripts.
 */
export function resolveOpenScriptEditorPath(
  state: CoreState,
  options?: ResolveOpenScriptEditorPathOptions,
): string | null {
  const openPaths = openScriptPaths(state)
  if (!state.project) return null

  const entityScript = entityOpenScriptPath(state)

  if (options?.preferSelection && entityScript) {
    return entityScript
  }

  if (state.activeScriptPath && openPaths.has(state.activeScriptPath)) {
    return state.activeScriptPath
  }

  if (entityScript) return entityScript

  const mainScript = state.project.mainScriptPath?.trim()
  if (mainScript && openPaths.has(mainScript)) return mainScript
  return null
}

/**
 * Preferred script path for Script Editor, including paths that still need loading.
 */
export function resolveScriptEditorTargetPath(state: CoreState): string | null {
  if (!state.project) return null

  const entityId = state.selection.entityId
  if (entityId != null) {
    const entityScript = state.project.entities?.[entityId]?.scriptPath?.trim()
    if (entityScript) return entityScript
  }

  const mainScript = state.project.mainScriptPath?.trim()
  return mainScript || null
}

export type ScriptEditorEmptyHintInput = Readonly<{
  project: CoreState['project']
  projectPath: CoreState['projectPath']
  selectionEntityId: number | null
  openScriptPaths: readonly string[]
}>

/** User-facing empty-state copy for ScriptEditorPanel. */
export function resolveScriptEditorEmptyHint(input: ScriptEditorEmptyHintInput): string {
  const { project, projectPath, selectionEntityId, openScriptPaths } = input
  if (!project) return 'Open a script from the Project panel.'

  const openPaths = new Set(openScriptPaths)
  const entity = selectionEntityId != null ? project.entities?.[selectionEntityId] : undefined

  if (entity) {
    const entityScript = entity.scriptPath?.trim()
    if (!entityScript) {
      return 'This entity has no script file. Gameplay rules live on the Logic Board.'
    }
    if (openPaths.has(entityScript)) {
      return 'Select the script tab above to edit this file.'
    }
    return projectPath
      ? 'Loading script…'
      : 'Save the project to disk before editing entity scripts.'
  }

  const mainScript = project.mainScriptPath?.trim()
  if (!mainScript) return 'Open a script from the Project panel.'
  if (openPaths.has(mainScript)) {
    return 'Select a script tab above.'
  }
  return projectPath
    ? 'Loading main script…'
    : 'Save the project to disk before editing scripts.'
}

/**
 * Open tab to activate synchronously. Async load uses resolveScriptEditorTargetPath.
 */
export function resolveScriptEditorActivationPath(
  state: CoreState,
  options?: ResolveOpenScriptEditorPathOptions,
): string | null {
  const target = resolveScriptEditorTargetPath(state)
  const openPaths = openScriptPaths(state)

  if (options?.preferSelection && target) {
    return openPaths.has(target) ? target : null
  }

  return resolveOpenScriptEditorPath(state, options)
}

export type ScriptEditorActivationDispatch = (action: Action) => void

/**
 * Sync/async Script Editor activation. Shared by the hook and unit tests.
 * Complements ui-reducer SET_MODE (sync path when tabs are already open).
 */
export function applyScriptEditorActivation(
  state: CoreState,
  dispatch: ScriptEditorActivationDispatch,
  options: ResolveOpenScriptEditorPathOptions,
  shouldAbort?: () => boolean,
): void {
  if (state.mode !== 'script' || !state.project) return

  const openPath = resolveScriptEditorActivationPath(state, options)
  if (openPath) {
    if (state.activeScriptPath !== openPath) {
      dispatch({ type: 'SET_ACTIVE_SCRIPT', path: openPath })
    }
    return
  }

  const target = resolveScriptEditorTargetPath(state)
  if (!target) return

  void openProjectScript(
    dispatch,
    {
      projectPath: state.projectPath,
      openScripts: state.openScripts,
    },
    target,
    shouldAbort ? { shouldAbort } : undefined,
  )
}
