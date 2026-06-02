import { createContext, useContext, type ReactNode } from 'react'
import { useEditorUiScale, type EditorUiScaleApi } from '../hooks/useEditorUiScale'

const EditorUiScaleContext = createContext<EditorUiScaleApi | null>(null)

export function EditorUiScaleProvider({ children }: Readonly<{ children: ReactNode }>) {
  const api = useEditorUiScale()
  return (
    <EditorUiScaleContext.Provider value={api}>
      {children}
    </EditorUiScaleContext.Provider>
  )
}

export function useEditorUiScaleContext(): EditorUiScaleApi {
  const ctx = useContext(EditorUiScaleContext)
  if (!ctx) {
    throw new Error('useEditorUiScaleContext must be used within EditorUiScaleProvider')
  }
  return ctx
}
