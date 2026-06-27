import { describe, expect, it } from 'vitest'
import {
  applyProjectRecoveryChoice,
  findNewerRecoveryCandidate,
  findRecoveryCandidate,
  type ProjectSaveArtifact,
} from './project-save-recovery'

describe('project-save-recovery', () => {
  const saved: ProjectSaveArtifact = {
    kind: 'saved',
    path: 'C:/game/project.json',
    modifiedUnixMs: 100,
    sizeBytes: 10,
  }

  it('returns null when only the saved file exists', () => {
    expect(findNewerRecoveryCandidate([saved])).toBeNull()
  })

  it('returns a newer backup or temp candidate', () => {
    const backup: ProjectSaveArtifact = {
      kind: 'backup',
      path: 'C:/game/project.json.bak',
      modifiedUnixMs: 200,
      sizeBytes: 12,
    }
    expect(findNewerRecoveryCandidate([backup, saved])).toEqual(backup)
  })

  it('ignores older recovery artifacts', () => {
    const temp: ProjectSaveArtifact = {
      kind: 'temp',
      path: 'C:/game/.project.json.artcade-tmp-1-2',
      modifiedUnixMs: 50,
      sizeBytes: 8,
    }
    expect(findNewerRecoveryCandidate([temp, saved])).toBeNull()
  })

  it('offers backup when project.json is unreadable even if older by mtime', () => {
    const backup: ProjectSaveArtifact = {
      kind: 'backup',
      path: 'C:/game/project.json.bak',
      modifiedUnixMs: 50,
      sizeBytes: 12,
    }
    expect(findRecoveryCandidate([backup, saved], { savedReadable: false })).toEqual(backup)
  })

  it('applies recovery choice paths', async () => {
    await expect(applyProjectRecoveryChoice('saved.json', 'recovery.json', 'recovery'))
      .resolves.toBe('recovery.json')
    await expect(applyProjectRecoveryChoice('saved.json', 'recovery.json', 'saved'))
      .resolves.toBe('saved.json')
  })
})
