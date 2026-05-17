import type {
  ProjectDoc, EntityDef, SceneDef, Vec2, Vec4, Transform, SpriteComponent,
  AnimationState, PhysicsComponent,
} from '../types'
import { parseLogicBoards } from './logic-board/factory'

// ---------------------------------------------------------------------------
// C++ JSON normalisation helpers
//
// The C++ runtime serialises Vec2 as [x, y] arrays and Vec4 as [x, y, z, w]
// arrays (nlohmann/json with custom serialisers).  We accept both the array
// form and the plain-object form so the editor works with hand-written JSON too.
// ---------------------------------------------------------------------------

function toVec2(v: unknown): Vec2 {
  if (Array.isArray(v))
    return { x: Number(v[0]) || 0, y: Number(v[1]) || 0 }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return { x: Number(o.x) || 0, y: Number(o.y) || 0 }
  }
  return { x: 0, y: 0 }
}

function toVec4(v: unknown): Vec4 {
  if (Array.isArray(v))
    return { x: Number(v[0]) || 0, y: Number(v[1]) || 0, z: Number(v[2]) || 0, w: v[3] != null ? Number(v[3]) : 1 }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    // C++ nlohmann/json serialises Vec4 as {r,g,b,a}; TypeScript uses {x,y,z,w}.
    // Accept both forms so the editor works with project files from either source.
    return {
      x: Number(o.x ?? o.r) || 0,
      y: Number(o.y ?? o.g) || 0,
      z: Number(o.z ?? o.b) || 0,
      w: (o.w ?? o.a) != null ? Number(o.w ?? o.a) : 1,
    }
  }
  return { x: 0, y: 0, z: 0, w: 1 }
}

function parseTransform(raw: unknown): Transform {
  if (!raw || typeof raw !== 'object') return { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 }
  const r = raw as Record<string, unknown>
  return {
    position: toVec2(r.position),
    scale:    toVec2(r.scale ?? [1, 1]),
    rotation: Number(r.rotation) || 0,
  }
}

function parseSprite(raw: unknown): SpriteComponent {
  if (!raw || typeof raw !== 'object') {
    return { spriteAssetId: '', tint: { x:1, y:1, z:1, w:1 }, alpha: 1, pivot: { x:0.5, y:0.5 }, renderOrder: 0 }
  }
  const r = raw as Record<string, unknown>
  return {
    spriteAssetId: String(r.spriteAssetId ?? r.sprite_asset_id ?? ''),
    tint:          toVec4(r.tint ?? [1, 1, 1, 1]),
    alpha:         r.alpha != null ? Number(r.alpha) : 1,
    pivot:         toVec2(r.pivot ?? [0.5, 0.5]),
    renderOrder:   Number(r.renderOrder ?? r.render_order) || 0,
  }
}

function parseAnimation(raw: unknown): AnimationState | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  return {
    currentAnim:   String(r.currentAnim ?? r.current_anim ?? ''),
    currentFrame:  Number(r.currentFrame ?? r.current_frame) || 0,
    frameDuration: Number(r.frameDuration ?? r.frame_duration) || 0,
    isPlaying:     Boolean(r.isPlaying ?? r.is_playing),
    isLooping:     Boolean(r.isLooping ?? r.is_looping),
  }
}

function parsePhysics(raw: unknown): PhysicsComponent | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const colliderRaw = r.collider && typeof r.collider === 'object'
    ? r.collider as Record<string, unknown>
    : {}
  return {
    bodyType: String(r.bodyType ?? r.body_type ?? 'Static') as PhysicsComponent['bodyType'],
    collider: {
      shape:    String(colliderRaw.shape ?? 'Rectangle') as PhysicsComponent['collider']['shape'],
      size:     toVec2(colliderRaw.size),
      offset:   toVec2(colliderRaw.offset),
      density:  Number(colliderRaw.density) || 0,
      friction: Number(colliderRaw.friction) || 0,
      isSensor: Boolean(colliderRaw.isSensor ?? colliderRaw.is_sensor),
    },
  }
}

function parseEntity(raw: unknown, fallbackId: number): EntityDef {
  if (!raw || typeof raw !== 'object') {
    return {
      id: fallbackId, name: `Entity_${fallbackId}`, className: 'Unknown',
      tags: [], transform: parseTransform(null), sprite: parseSprite(null),
    }
  }
  const r = raw as Record<string, unknown>
  return {
    id:        Number(r.id) || fallbackId,
    name:      String(r.name ?? `Entity_${fallbackId}`),
    className: String(r.className ?? r.class_name ?? 'Unknown'),
    tags:      Array.isArray(r.tags) ? r.tags.map(String) : [],
    transform: parseTransform(r.transform),
    sprite:    parseSprite(r.sprite),
    animation:  parseAnimation(r.animation),
    physics:    parsePhysics(r.physics),
    scriptPath: r.scriptPath != null ? String(r.scriptPath) : (r.script_path != null ? String(r.script_path) : undefined),
  }
}

function parseScene(raw: unknown, fallbackId: string): SceneDef {
  if (!raw || typeof raw !== 'object') {
    return {
      id: fallbackId, name: fallbackId,
      worldSize:       { x: 1280, y: 720 },
      viewportSize:    { x: 1280, y: 720 },
      backgroundColor: { x: 0.04, y: 0.07, z: 0.13, w: 1 },
      entityIds: [],
    }
  }
  const r = raw as Record<string, unknown>
  return {
    id:              String(r.id ?? fallbackId),
    name:            String(r.name ?? fallbackId),
    worldSize:       toVec2(r.worldSize ?? r.world_size ?? [1280, 720]),
    viewportSize:    toVec2(r.viewportSize ?? r.viewport_size ?? [1280, 720]),
    backgroundColor: toVec4(r.backgroundColor ?? r.background_color ?? [0.04, 0.07, 0.13, 1]),
    entityIds:       (() => {
                       const raw = r.entityIds ?? r.entity_ids
                       return Array.isArray(raw) ? (raw as unknown[]).map(Number) : []
                     })(),
  }
}

/**
 * Parse a project.json string produced by the C++ runtime.
 * Handles Vec2/Vec4 as either `[x,y]` arrays or `{x,y}` objects.
 * Returns null if the JSON is invalid or missing required fields.
 */
export function parseProjectDoc(jsonStr: string): ProjectDoc | null {
  try {
    const raw = JSON.parse(jsonStr) as Record<string, unknown>

    // ---- entities ----------------------------------------------------------
    // C++ may emit an array [{id,name,...}, ...] or an object {"1":{...}, ...}
    const entitiesRaw = raw.entities
    const entities: Record<number, EntityDef> = {}

    if (Array.isArray(entitiesRaw)) {
      for (const item of entitiesRaw) {
        const ent = parseEntity(item, Object.keys(entities).length + 1)
        entities[ent.id] = ent
      }
    } else if (entitiesRaw && typeof entitiesRaw === 'object') {
      for (const [key, value] of Object.entries(entitiesRaw as object)) {
        const ent = parseEntity(value, Number(key) || 0)
        entities[ent.id] = ent
      }
    }

    // ---- scenes ------------------------------------------------------------
    const scenesRaw = raw.scenes
    const scenes: Record<string, SceneDef> = {}

    if (Array.isArray(scenesRaw)) {
      for (const item of scenesRaw) {
        const sc = parseScene(item, `scene_${Object.keys(scenes).length}`)
        scenes[sc.id] = sc
      }
    } else if (scenesRaw && typeof scenesRaw === 'object') {
      for (const [key, value] of Object.entries(scenesRaw as object)) {
        const sc = parseScene(value, key)
        scenes[sc.id] = sc
      }
    }

    const firstSceneId = Object.keys(scenes)[0] ?? ''

    return {
      projectName:    String(raw.projectName ?? raw.project_name ?? 'Untitled'),
      version:        String(raw.version ?? '1.0.0'),
      licenseTier:    (() => {
                       const tier = String(raw.licenseTier ?? raw.license_tier ?? 'free')
                       return tier === 'pro' ? 'pro' : 'free'
                     })(),
      gameResolution: toVec2(raw.gameResolution ?? raw.game_resolution ?? [1280, 720]),
      targetFPS:      Number(raw.targetFPS ?? raw.target_fps ?? 60),
      activeSceneId:  String(raw.activeSceneId ?? raw.active_scene_id ?? firstSceneId),
      mainScriptPath: String(raw.mainScriptPath ?? raw.main_script_path ?? 'scripts/main.lua'),
      entities,
      scenes,
      thumbnails:     raw.thumbnails && typeof raw.thumbnails === 'object'
                       ? Object.fromEntries(Object.entries(raw.thumbnails as Record<string, unknown>).map(
                           ([key, value]) => [key, String(value)]
                         ))
                       : undefined,
      logicBoards:    parseLogicBoards(raw.logicBoards ?? raw.logic_boards),
    }
  } catch {
    return null
  }
}

function vec2Array(v: Vec2): [number, number] {
  return [v.x, v.y]
}

function vec4Array(v: Vec4): [number, number, number, number] {
  return [v.x, v.y, v.z, v.w]
}

function serializeTransform(t: Transform) {
  return {
    position: vec2Array(t.position),
    scale:    vec2Array(t.scale),
    rotation: t.rotation,
  }
}

function serializeSprite(sprite: SpriteComponent) {
  return {
    spriteAssetId: sprite.spriteAssetId,
    tint:          vec4Array(sprite.tint),
    alpha:         sprite.alpha,
    renderOrder:   sprite.renderOrder,
    ...(sprite.pivot ? { pivot: vec2Array(sprite.pivot) } : {}),
  }
}

function serializeEntity(entity: EntityDef) {
  return {
    id:        entity.id,
    name:      entity.name,
    className: entity.className,
    tags:      entity.tags,
    transform: serializeTransform(entity.transform),
    sprite:    serializeSprite(entity.sprite),
    ...(entity.scriptPath ? { scriptPath: entity.scriptPath } : {}),
    ...(entity.animation ? { animation: entity.animation } : {}),
    ...(entity.physics ? { physics: entity.physics } : {}),
  }
}

function serializeScene(scene: SceneDef) {
  return {
    id:              scene.id,
    name:            scene.name,
    worldSize:       vec2Array(scene.worldSize),
    viewportSize:    vec2Array(scene.viewportSize),
    backgroundColor: vec4Array(scene.backgroundColor),
    entityIds:       scene.entityIds,
  }
}

export function serializeProjectDoc(project: ProjectDoc): string {
  const entities = Object.fromEntries(
    Object.values(project.entities)
      .sort((a, b) => a.id - b.id)
      .map(entity => [String(entity.id), serializeEntity(entity)])
  )
  const scenes = Object.fromEntries(
    Object.values(project.scenes)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(scene => [scene.id, serializeScene(scene)])
  )

  const json = {
    projectName:    project.projectName,
    version:        project.version,
    licenseTier:    project.licenseTier ?? 'free',
    gameResolution: vec2Array(project.gameResolution),
    targetFPS:      project.targetFPS,
    activeSceneId:  project.activeSceneId,
    mainScriptPath: project.mainScriptPath,
    entities,
    scenes,
    ...(project.thumbnails ? { thumbnails: project.thumbnails } : {}),
    ...(project.logicBoards && project.logicBoards.length > 0
      ? { logicBoards: project.logicBoards }
      : {}),
  }

  return `${JSON.stringify(json, null, 2)}\n`
}

// ---------------------------------------------------------------------------
// Convenience helpers (unchanged from Phase 18)
// ---------------------------------------------------------------------------

/** Entities that belong to a given scene, in entityIds order. */
export function getEntitiesInScene(project: ProjectDoc, sceneId: string): EntityDef[] {
  const scene = project.scenes[sceneId]
  if (!scene) return []
  return scene.entityIds
    .map(id => project.entities[id])
    .filter((e): e is EntityDef => Boolean(e))
}

/** Active scene, falling back to the first scene available. */
export function getActiveScene(project: ProjectDoc, sceneId?: string | null): SceneDef | undefined {
  return project.scenes[sceneId ?? project.activeSceneId]
    ?? Object.values(project.scenes)[0]
}

/** Human-readable label: "Hero (Player)" */
export function entityLabel(entity: EntityDef): string {
  return entity.name === entity.className
    ? entity.name
    : `${entity.name} (${entity.className})`
}

/** All unique class names across all entities in the project. */
export function allClassNames(project: ProjectDoc): string[] {
  return [...new Set(Object.values(project.entities).map(e => e.className))].sort()
}

/** Extract directory from an absolute file path (works for / and \ separators). */
export function dirName(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(0, idx) : filePath
}
