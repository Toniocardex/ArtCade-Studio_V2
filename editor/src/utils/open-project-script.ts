import type { CoreState } from '../store/editor-store-state'
import type { Action } from '../store/editor-store-state'
import { loadScript, resolveScriptPath } from './api'

export type OpenScriptDispatch = (action: Action) => void

export type OpenScriptContext = Readonly<{
  projectPath: string | null
  openScripts: CoreState['openScripts']
}>

/**
 * Open a project Lua script in the script editor. Reuses an open tab when present;
 * otherwise loads from disk before OPEN_SCRIPT (never empty buffer over existing files).
 */
export async function openProjectScript(
  dispatch: OpenScriptDispatch,
  ctx: OpenScriptContext,
  path: string,
): Promise<void> {
  const existing = ctx.openScripts.find((s) => s.path === path)
  if (existing) {
    dispatch({ type: 'SET_ACTIVE_SCRIPT', path })
    dispatch({ type: 'SET_MODE', mode: 'script' })
    return
  }

  let content = ''
  try {
    if (ctx.projectPath) {
      const abs = resolveScriptPath(ctx.projectPath, path)
      const loaded = await loadScript(abs)
      if (loaded !== null) content = loaded
    }
  } catch (err) {
    console.warn('[openProjectScript] loadScript failed; opening empty buffer:', err)
  }

  dispatch({
    type: 'OPEN_SCRIPT',
    file: { path, content, isDirty: false },
  })
  dispatch({ type: 'SET_MODE', mode: 'script' })
}
