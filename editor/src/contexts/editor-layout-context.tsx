import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useEditor } from '../store/editor-store'
import { usePersistedLayout, type PersistedLayoutApi } from '../hooks/usePersistedLayout'

const EditorLayoutContext = createContext<PersistedLayoutApi | null>(null)

/** Must render inside EditorLayoutTierProvider (workspace metrics for layout bucket). */
export function EditorLayoutProvider({ children }: Readonly<{ children: ReactNode }>) {
  const layout = usePersistedLayout()
  const { dispatch } = useEditor()

  useEffect(() => {
    dispatch({
      type: 'SET_BOTTOM_PANEL_COLLAPSED',
      collapsed: layout.dockCollapsed,
    })
  }, [layout.bucketWidth, layout.bucketHeight, layout.dockCollapsed, dispatch])

  return (
    <EditorLayoutContext.Provider value={layout}>
      {children}
    </EditorLayoutContext.Provider>
  )
}

export function useEditorLayoutContext(): PersistedLayoutApi {
  const ctx = useContext(EditorLayoutContext)
  if (!ctx) {
    throw new Error('useEditorLayoutContext must be used within EditorLayoutProvider')
  }
  return ctx
}
