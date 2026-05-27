import type { ProjectDoc, EntityDef, SceneDef, Vec2 } from '../types'
import { DEFAULT_SCENE_SIZE, DEFAULT_EDITOR_GRID_SIZE } from '../constants/editor-viewport'
import { getEditorVisibleWorldCenter } from './editor-viewport-center'
import { clampEntityPositionToScene, normalizeEntityPosition } from './entity-position'

const sceneSize = (): Vec2 => ({ x: DEFAULT_SCENE_SIZE.x, y: DEFAULT_SCENE_SIZE.y })

/** Next free numeric entity id for a project. */
export function nextEntityId(project: ProjectDoc): number {
  const ids = Object.keys(project.entities).map(Number).filter(Number.isFinite)
  return (ids.length ? Math.max(...ids) : 0) + 1
}

/** Next stable scene id. Keeps legacy ids such as scene_main untouched. */
export function nextSceneId(project: ProjectDoc): string {
  let i = 2
  while (project.scenes[`scene_${i}`]) i += 1
  return `scene_${i}`
}

/** Unique display name for a scene, preserving stable technical ids. */
export function uniqueSceneName(
  project: ProjectDoc,
  baseName: string,
  excludingSceneId?: string,
): string {
  const base = baseName.trim() || 'Scene'
  const taken = new Set(
    Object.values(project.scenes)
      .filter((s) => s.id !== excludingSceneId)
      .map((s) => s.name),
  )
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base} ${i}`)) i += 1
  return `${base} ${i}`
}

/** Create an empty scene, inheriting viewport/world defaults from a source scene. */
export function createSceneDef(
  project: ProjectDoc,
  sourceScene?: SceneDef,
  name?: string,
): SceneDef {
  const id = nextSceneId(project)
  const numericSuffix = id.match(/(\d+)$/)?.[1] ?? String(Object.keys(project.scenes).length + 1)
  return {
    id,
    name: uniqueSceneName(project, name ?? `Scene ${numericSuffix}`, id),
    worldSize: sourceScene?.worldSize ?? sceneSize(),
    viewportSize: sourceScene?.viewportSize ?? sceneSize(),
    backgroundColor: sourceScene?.backgroundColor ?? { x: 0.082, y: 0.090, z: 0.110, w: 1 },
    entityIds: [],
  }
}

/** World position for a newly added entity — centre of visible canvas or viewport. */
export function defaultEntitySpawnPosition(
  scene: SceneDef,
  gridSize = DEFAULT_EDITOR_GRID_SIZE,
  snapToGrid = false,
): Vec2 {
  const vp = scene.viewportSize ?? scene.worldSize ?? sceneSize()
  const ws = scene.worldSize ?? vp
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v))
  const visible = getEditorVisibleWorldCenter()
  const raw = visible ?? { x: vp.x * 0.5, y: vp.y * 0.5 }
  const cx = clamp(raw.x, ws.x)
  const cy = clamp(raw.y, ws.y)
  return clampEntityPositionToScene(
    normalizeEntityPosition(cx, cy, snapToGrid, gridSize),
    ws,
  )
}

/** A new EntityDef with sane defaults (Phase B — add entity). */
export function createEntityDef(
  id: number,
  name = `Entity_${id}`,
  className = 'Entity',
  position?: Vec2,
): EntityDef {
  return {
    id, name, className, tags: [],
    transform: {
      position: position ?? { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
    },
    sprite: {
      spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0,
    },
    visible: true,
  }
}
