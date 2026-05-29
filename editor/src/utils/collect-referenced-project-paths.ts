import type { ProjectDoc } from '../types'
import type { LogicAction } from '../types/logic-board'
import { collectSceneAssetRefs, collectSceneAudioRefs } from './collect-scene-asset-refs'

function addAudioFromAction(project: ProjectDoc, action: LogicAction, paths: Set<string>): void {
  if (action.type !== 'playSound' && action.type !== 'playMusic') return
  const id = action.audioAssetId?.trim()
  if (id) {
    const lib = project.audioAssets?.[id]?.path?.trim()
    if (lib) paths.add(lib)
    return
  }
  const raw = action.path?.trim()
  if (raw) paths.add(raw)
}

/** All project-relative file paths referenced by gameplay (export pack list). */
export function collectReferencedProjectPaths(project: ProjectDoc): string[] {
  const paths = new Set<string>()
  for (const sceneId of Object.keys(project.scenes)) {
    for (const p of collectSceneAssetRefs(project, sceneId)) paths.add(p)
    for (const p of collectSceneAudioRefs(project, sceneId)) paths.add(p)
  }
  for (const board of project.logicBoards ?? []) {
    for (const event of board.events ?? []) {
      for (const action of event.actions ?? []) {
        addAudioFromAction(project, action, paths)
      }
    }
  }
  for (const a of Object.values(project.assets ?? {})) {
    if (a.path.trim()) paths.add(a.path.trim())
  }
  for (const a of Object.values(project.audioAssets ?? {})) {
    if (a.path.trim()) paths.add(a.path.trim())
  }
  for (const a of Object.values(project.fontAssets ?? {})) {
    if (a.path.trim()) paths.add(a.path.trim())
  }
  for (const ts of Object.values(project.tilesets ?? {})) {
    if (ts.spriteImagePath.trim()) paths.add(ts.spriteImagePath.trim())
  }
  if (project.mainScriptPath.trim()) paths.add(project.mainScriptPath.trim())
  return [...paths].sort()
}
