import { useEditor } from '../../store/editor-store'
import type { EntityDef } from '../../types'
import { Field, InspectorSection } from './inspector-fields'
import { loadScript, resolveScriptPath } from '../../utils/api'

export function ScriptSection({ entity }: { entity: EntityDef }) {
  const { state, dispatch } = useEditor()
  if (!entity.scriptPath) return null

  async function openInEditor() {
    const path = entity.scriptPath!
    // If the tab is already open, just switch to it — never reload the
    // content from disk, that would clobber unsaved edits.
    const existing = state.openScripts.find(s => s.path === path)
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_SCRIPT', path })
      dispatch({ type: 'SET_MODE', mode: 'script' })
      return
    }

    // Read the script from disk before opening. Previously the tab was
    // opened with content:'' which meant the next Save wrote an empty
    // buffer over the real file — pure data loss for any entity that had
    // existing Lua code.
    let content = ''
    try {
      if (state.projectPath) {
        const abs = resolveScriptPath(state.projectPath, path)
        const loaded = await loadScript(abs)
        if (loaded !== null) content = loaded
      }
    } catch (err) {
      console.warn('[ScriptSection] loadScript failed; opening empty buffer:', err)
    }

    dispatch({
      type: 'OPEN_SCRIPT',
      file: { path, content, isDirty: false },
    })
  }

  return (
    <InspectorSection label="Script">
      <Field label="Path" value={entity.scriptPath} />
      <button
        onClick={openInEditor}
        className="w-full mt-1 px-3 py-1 bg-[rgb(var(--accent-2-rgb)/0.1)] border border-[rgb(var(--accent-2-rgb)/0.4)]
                   text-[var(--accent-2)] text-[10px] font-bold rounded hover:bg-[rgb(var(--accent-2-rgb)/0.2)]
                   transition-colors"
      >
        OPEN IN SCRIPT EDITOR →
      </button>
    </InspectorSection>
  )
}
