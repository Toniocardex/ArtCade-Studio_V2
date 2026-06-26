// ---------------------------------------------------------------------------
// runtime-sync-diff — choose full reload vs incremental editor→runtime sync
// ---------------------------------------------------------------------------

import {
  runtimeProjectProjection,
  type RuntimeProjection,
} from './runtime-fingerprint'
import type { ProjectDoc, TilemapLayer } from '../types'

export type TilemapLayersSyncPayload = {
  /** Ordered LayerIds (index 0 = highest priority), matches tilemapLayers keys. */
  layerIds: string[]
  tilemapLayers: Record<string, TilemapLayer>
  mergedData: number[]
}

export type ProjectSyncPlan =
  | { kind: 'none' }
  | { kind: 'full' }
  | { kind: 'tilemap_data_only'; data: number[] }
  | { kind: 'tilemap_layers_only'; payload: TilemapLayersSyncPayload }
  | { kind: 'incremental'; entityIds: number[]; sceneIds: string[] }

function sortedEntityIds(proj: RuntimeProjection): number[] {
  return proj.entities.map((e) => e.id).sort((a, b) => a - b)
}

function sceneSettingsKey(scene: RuntimeProjection['scenes'][number]): string {
  return JSON.stringify({ ws: scene.ws, vs: scene.vs, bg: scene.bg, ls: scene.ls })
}

function tilemapStructKey(tm: RuntimeProjection['scenes'][number]['tm']): string {
  return tm ? `${tm.ts}|${tm.c}|${tm.r}|${tm.set ?? ''}` : 'none'
}

function tileLayerStructKey(layer: NonNullable<RuntimeProjection['scenes'][number]['tl']>[string]): string {
  const srcKey = layer.src?.length ? layer.src.join(',') : (layer.set ?? '')
  return `${layer.ts}|${layer.c}|${layer.r}|${srcKey}`
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
    prev.msp !== next.msp ||
    prev.wd !== next.wd ||
    JSON.stringify(prev.lyr) !== JSON.stringify(next.lyr)
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
  let tilemapLayersOnly: TilemapLayersSyncPayload | null = null
  let tilemapDataOnlyScene: { sceneId: string; data: number[] } | null = null

  for (const scene of next.scenes) {
    const ps = prevScenes.get(scene.id)
    if (!ps) return { kind: 'full' }
    if (JSON.stringify(ps.e) !== JSON.stringify(scene.e)) return { kind: 'full' }

    if (JSON.stringify(ps.tl) !== JSON.stringify(scene.tl)) {
      if (!ps.tl || !scene.tl) return { kind: 'full' }
      const names = new Set([...Object.keys(ps.tl), ...Object.keys(scene.tl)])
      for (const name of names) {
        const a = ps.tl[name]
        const b = scene.tl[name]
        if (!a || !b) return { kind: 'full' }
        if (tileLayerStructKey(a) !== tileLayerStructKey(b)) return { kind: 'full' }
      }
      if (tilemapLayersOnly) return { kind: 'full' }
      const sceneDoc = project.scenes?.[scene.id]
      if (!sceneDoc?.tilemapLayers || !sceneDoc.tilemap?.data) return { kind: 'full' }
      tilemapLayersOnly = {
        layerIds: next.lyr.map((l) => l.id),
        tilemapLayers: sceneDoc.tilemapLayers,
        mergedData: sceneDoc.tilemap.data,
      }
    }

    if (JSON.stringify(ps.tm) !== JSON.stringify(scene.tm)) {
      if (tilemapStructKey(ps.tm) !== tilemapStructKey(scene.tm)) return { kind: 'full' }
      // Merged grid dh also moves on layer paint — covered by tilemap_layers_only.
      if (tilemapLayersOnly) continue
      if (tilemapDataOnlyScene) return { kind: 'full' }
      const tileData = project.scenes?.[scene.id]?.tilemap?.data
      if (!tileData) return { kind: 'full' }
      tilemapDataOnlyScene = { sceneId: scene.id, data: tileData }
    }
  }

  if (tilemapLayersOnly) {
    return { kind: 'tilemap_layers_only', payload: tilemapLayersOnly }
  }
  if (tilemapDataOnlyScene) {
    return { kind: 'tilemap_data_only', data: tilemapDataOnlyScene.data }
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
