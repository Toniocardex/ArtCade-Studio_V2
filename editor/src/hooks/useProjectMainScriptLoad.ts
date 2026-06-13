import { useEffect } from 'react'
import { useEditorDispatch, useEditorSelector, useEditorStore } from '../store/editor-store'
import { loadScript, resolveScriptPath } from '../utils/api'
import { BLANK_MAIN_LUA } from '../utils/project-factory'
import {
  LEGACY_MAIN_LUA_MIGRATION_MESSAGE,
  migrateLegacyGeneratedMainLua,
} from '../utils/project-main-script'
import { makeConsoleEntry } from '../components/menu-bar/makeConsoleEntry'

/** Load the user-owned main script after every LOAD_PROJECT. */
export function useProjectMainScriptLoad(): void {
  const dispatch = useEditorDispatch()
  const store = useEditorStore()
  const projectLoadEpoch = useEditorSelector((state) => state.projectLoadEpoch)

  useEffect(() => {
    let cancelled = false
    const loadMainScript = async () => {
      const state = store.getState()
      const project = state.project
      if (!project?.mainScriptPath) return
      let content = BLANK_MAIN_LUA
      if (state.projectPath) {
        const loaded = await loadScript(resolveScriptPath(state.projectPath, project.mainScriptPath))
        if (loaded !== null) content = loaded
      }
      if (cancelled) return
      if (store.getState().openScripts.some((script) => script.path === project.mainScriptPath)) {
        return
      }
      const migration = migrateLegacyGeneratedMainLua(content)
      dispatch({
        type: 'UPSERT_SCRIPT',
        path: project.mainScriptPath,
        content: migration.content,
        isDirty: migration.isDirty,
        activate: false,
      })
      if (migration.migrated) {
        dispatch({
          type: 'LOG',
          entry: makeConsoleEntry(LEGACY_MAIN_LUA_MIGRATION_MESSAGE, 'info'),
        })
      }
    }
    void loadMainScript()
    return () => { cancelled = true }
  }, [projectLoadEpoch, dispatch, store])
}
