// ---------------------------------------------------------------------------
// runtime-sync-diff — choose full reload vs incremental editor→runtime sync
// ---------------------------------------------------------------------------

import {
  runtimeProjectProjection,
  type RuntimeProjection,
} from './runtime-fingerprint'
import type { ProjectDoc } from '../types'

export type ProjectSyncPlan =
  | { kind: 'none' }
  | { kind: 'full' }
  | { kind: 'incremental'; entityIds: number[]; sceneIds: string[] }

function sortedEntityIds(proj: RuntimeProjection): number[] {
  return proj.entities.map((e) => e.id).sort((a, b) => a - b)
}

function sceneSettingsKey(scene: RuntimeProjection['scenes'][number]): string {
  return JSON.stringify({ ws: scene.ws, vs: scene.vs, bg: scene.bg })
}

/**
 * Compare the previous runtime projection with the next ProjectDoc state and
 * decide whether to full-reload, patch incrementally, or skip.
 */
export function planProjectSync(
  prev: RuntimeProjection | null,
  project: ProjectDoc,
  activeSceneId: string,
): ProjectSyncPlan {
  const next = runtimeProjectProjection(project, activeSceneId)
  if (!prev) return { kind: 'full' }

  if (
    prev.pn !== next.pn ||
    prev.pv !== next.pv ||
    prev.as !== next.as ||
    prev.fps !== next.fps ||
    prev.msp !== next.msp
  ) {
    return { kind: 'full' }
  }

  const prevIds = sortedEntityIds(prev)
  const nextIds = sortedEntityIds(next)
  if (
    prevIds.length !== nextIds.length ||
    prevIds.some((id, i) => id !== nextIds[i])
  ) {
    return { kind: 'full' }
  }

  const prevScenes = new Map(prev.scenes.map((s) => [s.id, s]))
  for (const scene of next.scenes) {
    const ps = prevScenes.get(scene.id)
    if (!ps) return { kind: 'full' }
    if (JSON.stringify(ps.e) !== JSON.stringify(scene.e)) return { kind: 'full' }
    if (JSON.stringify(ps.tm) !== JSON.stringify(scene.tm)) return { kind: 'full' }
  }

  const entityUpdates: number[] = []
  const prevEnt = new Map(prev.entities.map((e) => [e.id, e]))
  for (const ent of next.entities) {
    const pe = prevEnt.get(ent.id)
    if (!pe || JSON.stringify(pe) !== JSON.stringify(ent))
      entityUpdates.push(ent.id)
  }

  const sceneUpdates: string[] = []
  for (const scene of next.scenes) {
    const ps = prevScenes.get(scene.id)!
    if (sceneSettingsKey(ps) !== sceneSettingsKey(scene))
      sceneUpdates.push(scene.id)
  }

  if (entityUpdates.length === 0 && sceneUpdates.length === 0)
    return { kind: 'none' }

  return { kind: 'incremental', entityIds: entityUpdates, sceneIds: sceneUpdates }
}
