import { useCallback, useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import type { Action as EditorAction } from '../../store/editor-store'
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
  dispatch: Dispatch<EditorAction>,
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
      dispatch({ type: 'PROJECT_RENAME', name: nextProject.projectName })
    }
  }, [draft, dispatch, project])

  const flushBeforePersist = useCallback((): ProjectDoc | null => {
    if (!project) return null
    const { project: nextProject, nextDraft, didRename } = flushProjectNameDraft(project, draft)
    if (nextDraft !== draft) setDraft(nextDraft)
    if (didRename) {
      dispatch({ type: 'PROJECT_RENAME', name: nextProject.projectName })
    }
    return nextProject
  }, [draft, dispatch, project])

  return { draft, setDraft, commitDraft, flushBeforePersist }
}
