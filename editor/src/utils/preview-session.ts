import type { DialogScript } from './dialog/dialog-script'
import {
  formatHealthSummary,
  getProjectWorkbenchSnapshot,
  type ProjectHealth,
} from './project-health'
import type { PreviewTransitionBundle } from './runtime-sync-service'
import type { ProjectDoc, ScriptFile, Vec2 } from '../types'

export interface PreviewSessionInput {
  project: ProjectDoc
  projectPath?: string | null
  openScripts: ScriptFile[]
  dialogs: Record<string, DialogScript>
  selectionSceneId?: string | null
}

export interface PreviewSessionBundle {
  bundle: PreviewTransitionBundle
  viewportSize: Vec2
  health: ProjectHealth
  compileError: string | null
}

export type PreviewSessionBuildResult =
  | { ok: true; session: PreviewSessionBundle }
  | { ok: false; message: string; health: ProjectHealth }

export function buildPreviewSessionBundle(
  input: PreviewSessionInput,
): PreviewSessionBuildResult {
  const activeSceneId = input.selectionSceneId ?? input.project.activeSceneId
  const scene = input.project.scenes?.[activeSceneId]
  const workbench = getProjectWorkbenchSnapshot({
    project: input.project,
    projectPath: input.projectPath,
    openScripts: input.openScripts,
    includeCompile: true,
  })

  if (workbench.health.blocksPlay) {
    const summary = formatHealthSummary(workbench.health)
    return {
      ok: false,
      health: workbench.health,
      message: `[Preview] Play blocked - fix project issues first.${summary ? `\n${summary}` : ''}`,
    }
  }

  if (!scene) {
    return {
      ok: false,
      health: workbench.health,
      message: `[Preview] Play blocked - active scene "${activeSceneId}" was not found.`,
    }
  }

  return {
    ok: true,
    session: {
      bundle: {
        project: input.project,
        activeSceneId,
        mainLua: workbench.previewLua.lua,
        dialogs: input.dialogs,
        projectPath: input.projectPath,
      },
      viewportSize: scene.viewportSize,
      health: workbench.health,
      compileError: workbench.previewLua.compileError,
    },
  }
}
