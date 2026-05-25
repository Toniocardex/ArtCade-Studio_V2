import { createContext, useContext, type ReactNode } from 'react'
import { useEditor } from '../../store/editor-store'
import { useProjectNameEditor } from './useProjectNameEditor'
import type { ProjectDoc } from '../../types'

export interface ProjectNamePersistContextValue {
  draft: string
  setDraft: (value: string) => void
  commitDraft: () => void
  flushBeforePersist: () => ProjectDoc | null
}

const ProjectNamePersistContext = createContext<ProjectNamePersistContextValue | null>(null)

export function ProjectNamePersistProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useEditor()
  const editor = useProjectNameEditor(state.project, dispatch)

  return (
    <ProjectNamePersistContext.Provider value={editor}>
      {children}
    </ProjectNamePersistContext.Provider>
  )
}

export function useProjectNamePersist(): ProjectNamePersistContextValue {
  const ctx = useContext(ProjectNamePersistContext)
  if (!ctx) {
    throw new Error('useProjectNamePersist must be used within ProjectNamePersistProvider')
  }
  return ctx
}
