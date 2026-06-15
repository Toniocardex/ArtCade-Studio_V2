import { LayoutGrid, Workflow, Code2 } from 'lucide-react'
import { useEditorDispatch, useEditorSelector } from '../../store/editor-store'
import { useLayoutTier } from '../../contexts/editor-layout-tier-context'
import type { EditorView } from '../../types'

const MODES: ReadonlyArray<{
  id: EditorView
  label: string
  icon: typeof LayoutGrid
}> = [
  { id: 'canvas', label: 'Canvas', icon: LayoutGrid },
  { id: 'logic', label: 'Logic Board', icon: Workflow },
  { id: 'script', label: 'Script Editor', icon: Code2 },
]

/** Inline mode switcher in the top bar — Canvas | Logic Board | Script Editor. */
export default function ModuleTabs() {
  const dispatch = useEditorDispatch()
  const mode = useEditorSelector((s) => s.mode)
  const tier = useLayoutTier()
  // Primary navigation: keep labels visible through 'compact' (a very common
  // window width); only collapse to icon-only when space is genuinely tight.
  const iconOnly = tier === 'minimal' || tier === 'unsupported'

  return (
    <nav className="editor-module-tabs" aria-label="Editor modules">
      {MODES.map(({ id, label, icon: Icon }) => {
        const active = mode === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => dispatch({ type: 'SET_MODE', mode: id })}
            onDoubleClick={() => {
              if (id === 'canvas') dispatch({ type: 'SET_FOCUS_MODE', enabled: true })
            }}
            title={label}
            aria-pressed={active}
            className={`editor-module-tab inline-flex items-center gap-1.5 ${
              active ? 'editor-module-tab--active' : ''
            }`}
          >
            <Icon size={15} strokeWidth={active ? 2.25 : 2} aria-hidden />
            {!iconOnly && label}
          </button>
        )
      })}
    </nav>
  )
}
