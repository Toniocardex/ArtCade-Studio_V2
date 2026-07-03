import { useCallback, useEffect, useState } from 'react'
import { safeProjectFolderName } from '../../utils/project'
import type { ProjectDoc } from '../../types'

export function flushProjectNameDraft(
  project: ProjectDoc,
  draft: string,
): { project: ProjectDoc; nextDraft: string; didRename: boolean } {
  const nextName = safeProjectFolderName(draft, 'Untitled')
  const didRename = nextName !== project.projectName
  return {
    project: didRename ? { ...project, projectName: nextName } : project,
    nextDraft: nextName,
    didRename,
  }
}

export function useProjectNameEditor(
  project: ProjectDoc | null,
  renameProject: (name: string) => void,
) {
  const [draft, setDraft] = useState(project?.projectName ?? 'Untitled')

  useEffect(() => {
    setDraft(project?.projectName ?? 'Untitled')
  }, [project?.projectName])

  const commitDraft = useCallback(() => {
    if (!project) return
    const { project: nextProject, nextDraft, didRename } = flushProjectNameDraft(project, draft)
    setDraft(nextDraft)
    if (didRename) {
      renameProject(nextProject.projectName)
    }
  }, [draft, project, renameProject])

  const flushBeforePersist = useCallback((): ProjectDoc | null => {
    if (!project) return null
    const { project: nextProject, nextDraft, didRename } = flushProjectNameDraft(project, draft)
    if (nextDraft !== draft) setDraft(nextDraft)
    if (didRename) {
      renameProject(nextProject.projectName)
    }
    return nextProject
  }, [draft, project, renameProject])

  return { draft, setDraft, commitDraft, flushBeforePersist }
}
