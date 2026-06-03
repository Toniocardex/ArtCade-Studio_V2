import { LayoutGrid, Workflow, Code2 } from 'lucide-react'
import { useEditor } from '../../store/editor-store'
import { useLayoutTier } from '../../contexts/editor-layout-tier-context'
import type { EditorView } from '../../types'
import { EditorTab } from '../ui/EditorTab'

const MODES: ReadonlyArray<{
  id: EditorView
  label: string
  icon: typeof LayoutGrid
}> = [
  { id: 'canvas', label: 'Canvas', icon: LayoutGrid },
  { id: 'logic', label: 'Logic Board', icon: Workflow },
  { id: 'script', label: 'Script Editor', icon: Code2 },
]

/** Horizontal module tabs — Canvas | Logic Board | Script Editor (3 core loop). */
export default function ModuleTabs() {
  const { state, dispatch } = useEditor()
  const tier = useLayoutTier()
  const iconOnly = tier !== 'full'

  return (
    <nav className="editor-module-tabs" aria-label="Editor modules">
      {MODES.map(({ id, label, icon: Icon }) => {
        const active = state.mode === id
        return (
          <EditorTab
            key={id}
            active={active}
            onClick={() => dispatch({ type: 'SET_MODE', mode: id })}
            onDoubleClick={() => {
              if (id === 'canvas') dispatch({ type: 'SET_FOCUS_MODE', enabled: true })
            }}
            title={label}
            className={`inline-flex items-center gap-2 ${iconOnly ? 'px-3 py-2.5' : 'px-4 py-2.5'}`}
          >
            <Icon size={14} strokeWidth={active ? 2.25 : 2} aria-hidden />
            {!iconOnly && label}
          </EditorTab>
        )
      })}
    </nav>
  )
}
