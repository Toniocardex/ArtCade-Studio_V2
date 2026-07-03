import { createContext, useContext, type ReactNode } from 'react'
import { useEditorSelector } from '../../store/editor-store'
import { useAuthoringCommands } from '../../authoring/useAuthoringCommands'
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
  const project = useEditorSelector((s) => s.project)
  const { renameProject } = useAuthoringCommands()
  const editor = useProjectNameEditor(project, renameProject)

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
