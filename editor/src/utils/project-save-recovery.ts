import { isTauri } from '@tauri-apps/api/core'
import { invokeTauri } from './tauri-invoke'
import {
  requestProjectSaveRecoveryChoice,
  type ProjectRecoveryChoice,
} from './project-save-recovery-prompt'
import { projectRootFromProjectPath } from './project-paths'

export type ProjectSaveArtifactKind = 'saved' | 'backup' | 'temp'

export interface ProjectSaveArtifact {
  kind: ProjectSaveArtifactKind
  path: string
  modifiedUnixMs: number
  sizeBytes: number
}

function artifactLabel(kind: ProjectSaveArtifactKind): string {
  if (kind === 'backup') return 'backup file'
  return 'recovery file'
}

export async function inspectProjectSaveArtifacts(
  projectJsonPath: string,
): Promise<ProjectSaveArtifact[]> {
  if (!isTauri()) return []
  return invokeTauri<ProjectSaveArtifact[]>('inspect_project_save_artifacts', {
    projectJsonPath,
  })
}

export function findNewerRecoveryCandidate(
  artifacts: readonly ProjectSaveArtifact[],
): ProjectSaveArtifact | null {
  const saved = artifacts.find((item) => item.kind === 'saved')
  const recoveryCandidates = artifacts.filter(
    (item) => item.kind === 'backup' || item.kind === 'temp',
  )
  if (recoveryCandidates.length === 0) return null
  const newest = recoveryCandidates[0]
  if (!saved) return newest
  if (newest.modifiedUnixMs > saved.modifiedUnixMs) return newest
  return null
}

export async function discardProjectSaveRecovery(
  path: string,
  projectJsonPath: string,
): Promise<void> {
  if (!isTauri()) return
  await invokeTauri<void>('discard_project_save_recovery', {
    path,
    projectRoot: projectRootFromProjectPath(projectJsonPath),
  })
}

/**
 * When a newer backup/temp exists than project.json, ask the user which file to open.
 * @returns absolute path to load
 */
export async function resolveProjectJsonOpenPath(
  projectJsonPath: string,
  artifacts: readonly ProjectSaveArtifact[] = [],
): Promise<string> {
  const inspected = artifacts.length > 0
    ? [...artifacts]
    : await inspectProjectSaveArtifacts(projectJsonPath)
  const listed = inspected ?? []
  const recovery = findNewerRecoveryCandidate(listed)
  if (!recovery) return projectJsonPath

  const choice = await requestProjectSaveRecoveryChoice(
    recovery.path,
    projectJsonPath,
    artifactLabel(recovery.kind),
  )
  return applyProjectRecoveryChoice(projectJsonPath, recovery.path, choice)
}

export async function applyProjectRecoveryChoice(
  savedPath: string,
  recoveryPath: string,
  choice: ProjectRecoveryChoice,
): Promise<string> {
  switch (choice) {
    case 'recovery':
      return recoveryPath
    case 'saved':
      return savedPath
    case 'discard':
      await discardProjectSaveRecovery(recoveryPath, savedPath)
      return savedPath
    default:
      return savedPath
  }
}
