// ---------------------------------------------------------------------------
// Preview Lua cache key — shared by runtime-hooks and project workbench cache.
// ---------------------------------------------------------------------------

import { runtimeProjectFingerprint } from './runtime-fingerprint'
import type { ProjectDoc, ScriptFile } from '../types'

export interface PreviewLuaSyncInput {
  project: ProjectDoc
  openScripts: ScriptFile[]
  projectPath?: string | null
}

function mainScriptTab(input: PreviewLuaSyncInput): ScriptFile | undefined {
  const path = input.project.mainScriptPath
  if (!path) return undefined
  return input.openScripts.find((s) => s.path === path)
}

/** Stable key for preview Lua recompile — excludes unrelated open script tabs. */
export function getPreviewLuaSyncKey(input: PreviewLuaSyncInput): string {
  const tab = mainScriptTab(input)
  return JSON.stringify({
    projectFp: runtimeProjectFingerprint(input.project, input.project.activeSceneId),
    projectPath: input.projectPath ?? '',
    mainDirty: Boolean(tab?.isDirty),
    mainContent: tab?.isDirty ? tab.content : '',
  })
}
