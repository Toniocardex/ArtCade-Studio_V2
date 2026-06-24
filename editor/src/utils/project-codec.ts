import type {
  ProjectDoc, EntityDef, SceneDef, SceneInstanceDef, ObjectTypeDef, Vec2, Vec3, Vec4,
  Transform, SpriteComponent, AnimationState, PhysicsComponent, PhysicsMode, WorldSettings,
  TilemapLayer, TileDef, TilesetAsset, ImageAsset, AudioAsset, FontAsset, ImagePointDef, AnimationClipDef,
  AnimationFrameRect, AssetVirtualFolderDef, AssetFolderCategory,
  GameVariableDefinition, GameVariableValue, ImageAssetUsage, LayerDef, LayerId, SceneLayerSettings,
} from '../types'
import { DEFAULT_WORLD, IMAGE_ASSET_USAGES } from '../types'
import { newLayerId } from '../constants/scene-layers'
import {
  parseLogicBoardsWithIssues,
  type ParseLogicBoardsResult,
} from './logic-board/factory'
import type { LogicBoardLoadIssue } from '../types/logic-board'
import { COMPONENT_KEYS } from '../types/components'
import { DEFAULT_SCENE_SIZE, DEFAULT_VIEWPORT_SIZE } from '../constants/editor-viewport'
import {
  normalizeProjectDoc,
  projectForSave,
  PROJECT_FORMAT_V3,
} from './project-object-types'
import { entityToObjectType } from './project-object-types'
import { normalizeTilemapLayer } from './tilemap-layer-sources'

// Plain mutable Vec2 helpers — DEFAULT_SCENE_SIZE is `as const`, so we wrap it
// to hand out fresh `{x,y}` literals (callers mutate worldSize/viewportSize).
const sceneSize = (): Vec2 => ({ x: DEFAULT_SCENE_SIZE.x, y: DEFAULT_SCENE_SIZE.y })
const viewportSize = (): Vec2 => ({ x: DEFAULT_VIEWPORT_SIZE.x, y: DEFAULT_VIEWPORT_SIZE.y })
const sceneSizeArray = (): [number, number] => [DEFAULT_SCENE_SIZE.x, DEFAULT_SCENE_SIZE.y]
const viewportSizeArray = (): [number, number] => [DEFAULT_VIEWPORT_SIZE.x, DEFAULT_VIEWPORT_SIZE.y]

export function unsupportedProjectFormatMessage(jsonStr: string): string | null {
  try {
    const raw = JSON.parse(jsonStr) as Record<string, unknown>
    const versionRaw = raw.formatVersion ?? raw.format_version
    if (versionRaw == null) return null
    const version = Number(versionRaw)
    if (!Number.isFinite(version) || version <= PROJECT_FORMAT_V3) return null
    return (
      `Cannot open this project.\n\n` +
      `Project format v${version} is newer than this editor supports ` +
      `(current: v${PROJECT_FORMAT_V3}).\n\n` +
      `Update ArtCade Studio, then open the project again.`
    )
  } catch {
    return null
  }
}

/** Pass through known ECS component objects defensively (only if object). */
function parseComponents(r: Record<string, unknown>): Record<string, object> {
  const out: Record<string, object> = {}
  for (const key of COMPONENT_KEYS) {
    const v = r[key]
    if (v && typeof v === 'object' && !Array.isArray(v)) out[key] = v as object
  }
  return out
}

function parseVariableValue(raw: unknown, type: GameVariableDefinition['type']): GameVariableValue {
  if (type === 'boolean') return raw === true
  if (type === 'string') return typeof raw === 'string' ? raw : ''
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

function parseVariableDefinitions(raw: unknown): GameVariableDefinition[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: GameVariableDefinition[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const key = typeof record.key === 'string' ? record.key.trim() : ''
    const type = record.type
    if (!key || seen.has(key) || (type !== 'number' && type !== 'boolean' && type !== 'string')) continue
    seen.add(key)
    out.push({
      key,
      type,
      initialValue: parseVariableValue(record.initialValue, type),
      ...(typeof record.description === 'string' && record.description.trim()
        ? { description: record.description.trim() }
        : {}),
    })
  }
  return out.length ? out : undefined
}

function parseVariableOverrides(raw: unknown): Record<string, GameVariableValue> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, GameVariableValue> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    else if (typeof value === 'boolean' || typeof value === 'string') out[key] = value
  }
  return Object.keys(out).length ? out : undefined
}

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

function toVec3(v: unknown): Vec3 {
  if (Array.isArray(v))
    return { x: Number(v[0]) || 0, y: Number(v[1]) || 0, z: Number(v[2]) || 0 }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return { x: Number(o.x) || 0, y: Number(o.y) || 0, z: Number(o.z) || 0 }
  }
  return { x: 1, y: 1, z: 1 }
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
    return {
      spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 },
      fillColor: { x: 1, y: 1, z: 1 },
      alpha: 1, pivotFromAsset: true, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0,
    }
  }
  const r = raw as Record<string, unknown>
  const spriteAssetId = String(r.spriteAssetId ?? r.sprite_asset_id ?? '')
  const tint = toVec4(r.tint ?? [1, 1, 1, 1])
  const fillColor = r.fillColor != null
    ? toVec3(r.fillColor)
    : { x: tint.x, y: tint.y, z: tint.z }
  const pivotFromAsset = r.pivotFromAsset !== false
  const defaultClipRaw = r.defaultClip ?? r.default_clip
  const defaultClip =
    typeof defaultClipRaw === 'string' && defaultClipRaw.trim().length > 0
      ? defaultClipRaw.trim()
      : undefined
  return {
    spriteAssetId,
    tint,
    fillColor,
    alpha:         r.alpha != null ? Number(r.alpha) : 1,
    pivotFromAsset,
    pivot:         pivotFromAsset ? { x: 0.5, y: 0.5 } : toVec2(r.pivot ?? [0.5, 0.5]),
    renderOrder:   Number(r.renderOrder ?? r.render_order) || 0,
    ...(defaultClip ? { defaultClip } : {}),
    ...(r.playClipOnSpawn === true || r.play_clip_on_spawn === true
      ? { playClipOnSpawn: true }
      : {}),
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
  let sprite = parseSprite(r.sprite)
  const legacyAnim = parseAnimation(r.animation)
  if (legacyAnim?.currentAnim?.trim() && !sprite.defaultClip) {
    sprite = { ...sprite, defaultClip: legacyAnim.currentAnim.trim() }
  }
  return {
    id:        Number(r.id) || fallbackId,
    name:      String(r.name ?? `Entity_${fallbackId}`),
    className: String(r.className ?? r.class_name ?? 'Unknown'),
    tags:      Array.isArray(r.tags) ? r.tags.map(String) : [],
    transform: parseTransform(r.transform),
    sprite,
    physics:    parsePhysics(r.physics),
    scriptPath: r.scriptPath != null ? String(r.scriptPath) : (r.script_path != null ? String(r.script_path) : undefined),
    visible: typeof r.visible === 'boolean' ? r.visible : true,
    localVariables: parseVariableDefinitions(r.localVariables ?? r.local_variables),
    localVariableOverrides: parseVariableOverrides(
      r.localVariableOverrides ?? r.local_variable_overrides,
    ),
    ...parseComponents(r),
  }
}

function parsePhysicsMode(raw: unknown): PhysicsMode {
  if (raw === 'off' || raw === 'on' || raw === 'auto') return raw
  return DEFAULT_WORLD.physicsMode ?? 'auto'
}

function parseWorld(raw: unknown): WorldSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  return {
    gravity:        Number(r.gravity ?? DEFAULT_WORLD.gravity),
    pixelsPerMeter: Number(r.pixelsPerMeter ?? DEFAULT_WORLD.pixelsPerMeter),
    timeScale:      Number(r.timeScale ?? DEFAULT_WORLD.timeScale),
    physicsMode:    parsePhysicsMode(r.physicsMode),
  }
}

function parseInstance(raw: unknown, fallbackId: number): SceneInstanceDef | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = Number(r.id) || fallbackId
  const objectTypeId = String(r.objectTypeId ?? r.object_type_id ?? '')
  if (!objectTypeId) return null
  return {
    id,
    objectTypeId,
    ...(r.instanceName != null ? { instanceName: String(r.instanceName) } : {}),
    ...(r.instance_name != null ? { instanceName: String(r.instance_name) } : {}),
    transform: parseTransform(r.transform),
    ...(typeof r.visible === 'boolean' && !r.visible ? { visible: false } : {}),
    ...(r.layerId != null && String(r.layerId).trim() ? { layerId: String(r.layerId) } : {}),
    ...(parseVariableOverrides(r.localVariableOverrides ?? r.local_variable_overrides)
      ? { localVariableOverrides: parseVariableOverrides(r.localVariableOverrides ?? r.local_variable_overrides) }
      : {}),
  }
}

function parseObjectType(raw: unknown, fallbackId: string): ObjectTypeDef | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = String(r.id ?? fallbackId)
  if (!id) return null
  const entLike = parseEntity(raw, 0)
  const type = entityToObjectType(entLike, id)
  type.displayName = String(r.displayName ?? r.display_name ?? entLike.name ?? id)
  if (r.defaultLogicBoardId != null) {
    type.defaultLogicBoardId = String(r.defaultLogicBoardId)
  }
  type.localVariables = parseVariableDefinitions(r.localVariables ?? r.local_variables)
  return type
}

function parseScene(raw: unknown, fallbackId: string): SceneDef {
  if (!raw || typeof raw !== 'object') {
    return {
      id: fallbackId, name: fallbackId,
      worldSize:       sceneSize(),
      viewportSize:    viewportSize(),
      backgroundColor: { x: 0.082, y: 0.090, z: 0.110, w: 1 },
      entityIds: [],
    }
  }
  const r = raw as Record<string, unknown>
  return {
    id:              String(r.id ?? fallbackId),
    name:            String(r.name ?? fallbackId),
    worldSize:       toVec2(r.worldSize ?? r.world_size ?? sceneSizeArray()),
    viewportSize:    toVec2(r.viewportSize ?? r.viewport_size ?? viewportSizeArray()),
    cameraStart:     (r.cameraStart ?? r.camera_start) != null
                       ? toVec2(r.cameraStart ?? r.camera_start)
                       : undefined,
    backgroundColor: toVec4(r.backgroundColor ?? r.background_color ?? [0.082, 0.090, 0.110, 1]),
    entityIds:       (() => {
                       const raw = r.entityIds ?? r.entity_ids
                       return Array.isArray(raw) ? (raw as unknown[]).map(Number) : []
                     })(),
    instances:       (() => {
                       const raw = r.instances
                       if (!Array.isArray(raw)) return undefined
                       const list = raw
                         .map((item, i) => parseInstance(item, i + 1))
                         .filter((x): x is SceneInstanceDef => x != null)
                       return list.length ? list : undefined
                     })(),
    ...(() => {
      const tm = parseTilemap(r.tilemap)
      const tilemapLayers = parseTilemapLayers(r.tilemapLayers ?? r.tilemap_layers)
      const layerSettings = parseLayerSettingsMap(r.layerSettings ?? r.layer_settings)
      return {
        ...(tm ? { tilemap: tm } : {}),
        ...(tilemapLayers ? { tilemapLayers } : {}),
        ...(layerSettings ? { layerSettings } : {}),
      }
    })(),
  }
}

function parseTilemap(raw: unknown): TilemapLayer | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const cols = Number(r.cols), rows = Number(r.rows)
  const tileSize = Number(r.tileSize) || 32
  if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 1 || rows < 1)
    return undefined
  const arr = Array.isArray(r.data) ? (r.data as unknown[]).map(Number) : []
  const data = new Array(cols * rows)
    .fill(0)
    .map((_, i) => (Number.isFinite(arr[i]) ? arr[i] : 0))
  const layer: TilemapLayer = { tileSize, cols, rows, data }
  if (typeof r.tilesetAssetId === 'string' && r.tilesetAssetId)
    layer.tilesetAssetId = r.tilesetAssetId
  if (typeof r.defaultTilesetAssetId === 'string' && r.defaultTilesetAssetId)
    layer.defaultTilesetAssetId = r.defaultTilesetAssetId
  const srcArr = Array.isArray(r.sourceIndices) ? (r.sourceIndices as unknown[]).map(Number) : null
  if (srcArr) {
    layer.sourceIndices = new Array(cols * rows)
      .fill(0)
      .map((_, i) => (Number.isFinite(srcArr[i]) ? srcArr[i] : 0))
  }
  const sourcesRaw = r.tilesetSources ?? r.tileset_sources
  if (Array.isArray(sourcesRaw)) {
    const sources = sourcesRaw
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const o = item as Record<string, unknown>
        const id = typeof o.tilesetAssetId === 'string'
          ? o.tilesetAssetId
          : typeof o.tileset_asset_id === 'string'
            ? o.tileset_asset_id
            : ''
        return id ? { tilesetAssetId: id } : null
      })
      .filter((x): x is { tilesetAssetId: string } => x != null)
    if (sources.length > 0) layer.tilesetSources = sources
  }
  return normalizeTilemapLayer(layer)
}

function parseTilemapLayers(raw: unknown): Record<string, TilemapLayer> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, TilemapLayer> = {}
  for (const [name, layerRaw] of Object.entries(raw as Record<string, unknown>)) {
    const layer = parseTilemap(layerRaw)
    if (layer) out[name] = layer
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function serializeTilemapLayer(layer: TilemapLayer): Record<string, unknown> {
  const normalized = normalizeTilemapLayer(layer)
  const base: Record<string, unknown> = {
    tileSize: normalized.tileSize,
    cols: normalized.cols,
    rows: normalized.rows,
    data: normalized.data,
  }
  if (normalized.tilesetSources?.length) {
    base.tilesetSources = normalized.tilesetSources.map((s) => ({
      tilesetAssetId: s.tilesetAssetId,
    }))
  }
  if (normalized.sourceIndices?.length) {
    base.sourceIndices = normalized.sourceIndices
  }
  if (normalized.defaultTilesetAssetId) {
    base.defaultTilesetAssetId = normalized.defaultTilesetAssetId
  }
  return base
}

function parseImagePoints(raw: unknown): ImagePointDef[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ImagePointDef[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const o = p as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    if (!id) continue
    const x = Number(o.x); const y = Number(o.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out.push({ id, x, y })
  }
  return out.length ? out : undefined
}

function parseAnimationClips(raw: unknown): AnimationClipDef[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: AnimationClipDef[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name : ''
    if (!name) continue
    const framesRaw = Array.isArray(o.frames) ? o.frames : []
    const frames: AnimationFrameRect[] = []
    for (const f of framesRaw) {
      if (!f || typeof f !== 'object') continue
      const fo = f as Record<string, unknown>
      const x = Number(fo.x); const y = Number(fo.y)
      const w = Number(fo.w); const h = Number(fo.h)
      if ([x, y, w, h].some((n) => !Number.isFinite(n))) continue
      frames.push({ x, y, w, h })
    }
    if (!frames.length) continue
    const fps = Number(o.fps)
    out.push({
      name,
      frames,
      fps: Number.isFinite(fps) && fps > 0 ? fps : 12,
      loop: Boolean(o.loop ?? true),
    })
  }
  return out.length ? out : undefined
}

function parseAssets(
  raw: unknown,
): Record<string, ImageAsset> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, ImageAsset> = {}
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const id = String(o.id ?? key)
    const path = String(o.path ?? '')
    const usage = o.usage as ImageAssetUsage
    if (!id || !path || !IMAGE_ASSET_USAGES.includes(usage)) continue
    const asset: ImageAsset = {
      id,
      name: String(o.name ?? id),
      path,
      usage,
      // dataUrl is transient — never read from persisted JSON.
    }
    if (typeof o.contentHash === 'string' && o.contentHash.trim())
      asset.contentHash = o.contentHash.trim()
    const imagePoints = parseImagePoints(o.imagePoints)
    if (imagePoints) asset.imagePoints = imagePoints
    const clips = parseAnimationClips(o.clips)
    if (clips) asset.clips = clips
    if (o.defaultPivot != null) asset.defaultPivot = toVec2(o.defaultPivot)
    out[id] = asset
  }
  return Object.keys(out).length ? out : undefined
}

function parseAudioAssets(
  raw: unknown,
): Record<string, AudioAsset> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, AudioAsset> = {}
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const id = String(o.id ?? key)
    const path = String(o.path ?? '')
    if (!id || !path) continue
    const cat = o.category
    const asset: AudioAsset = {
      id,
      name: String(o.name ?? id),
      path,
      ...(cat === 'sfx' || cat === 'music' ? { category: cat } : {}),
    }
    if (typeof o.contentHash === 'string' && o.contentHash.trim())
      asset.contentHash = o.contentHash.trim()
    const vol = Number(o.volume)
    if (Number.isFinite(vol)) asset.volume = vol
    out[id] = asset
  }
  return Object.keys(out).length ? out : undefined
}

function parseFontAssets(
  raw: unknown,
): Record<string, FontAsset> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, FontAsset> = {}
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const id = String(o.id ?? key)
    const path = String(o.path ?? '')
    if (!id || !path) continue
    const asset: FontAsset = {
      id,
      name: String(o.name ?? id),
      path,
    }
    if (typeof o.contentHash === 'string' && o.contentHash.trim())
      asset.contentHash = o.contentHash.trim()
    const defaultSize = Number(o.defaultSize ?? o.default_size)
    if (Number.isFinite(defaultSize) && defaultSize > 0) asset.defaultSize = defaultSize
    out[id] = asset
  }
  return Object.keys(out).length ? out : undefined
}

const ASSET_FOLDER_CATEGORIES: AssetFolderCategory[] = [
  'images',
  'audio',
  'fonts',
  'scripts',
  'tilesets',
]

function parseAssetVirtualFolders(
  raw: unknown,
): Record<string, AssetVirtualFolderDef> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, AssetVirtualFolderDef> = {}
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const id = String(o.id ?? key)
    const category = String(o.category ?? 'images') as AssetFolderCategory
    if (!id || !ASSET_FOLDER_CATEGORIES.includes(category)) continue
    const usage = o.usage as ImageAssetUsage
    if (category === 'images' && !IMAGE_ASSET_USAGES.includes(usage)) continue
    const refsRaw = o.assetRefs ?? o.asset_refs
    const assetRefs: AssetVirtualFolderDef['assetRefs'][number][] = []
    if (Array.isArray(refsRaw)) {
      for (const r of refsRaw) {
        if (!r || typeof r !== 'object') continue
        const ro = r as Record<string, unknown>
        const type = String(ro.type ?? '')
        const refId = String(ro.id ?? '')
        if (!refId) continue
        if (type === 'image' || type === 'audio' || type === 'font' || type === 'tileset') {
          assetRefs.push({ type, id: refId })
        }
      }
    }
    out[id] = {
      id,
      name: String(o.name ?? 'Folder'),
      category,
      ...(category === 'images' ? { usage } : {}),
      assetRefs,
    }
  }
  return Object.keys(out).length ? out : undefined
}

function parseTilesets(
  raw: unknown,
): Record<string, TilesetAsset> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, TilesetAsset> = {}
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const assetId = String(o.assetId ?? o.asset_id ?? key)
    if (!assetId) continue
    out[assetId] = {
      assetId,
      name:            String(o.name ?? assetId),
      spriteImagePath: String(o.spriteImagePath ?? o.sprite_image_path ?? ''),
      ...(typeof o.contentHash === 'string' && o.contentHash.trim()
        ? { contentHash: o.contentHash.trim() }
        : {}),
      tileSize:        Number(o.tileSize ?? o.tile_size ?? 32),
      margin:          Number(o.margin ?? 0),
      cols:            Number(o.cols ?? 1),
      rows:            Number(o.rows ?? 1),
    }
  }
  return Object.keys(out).length ? out : undefined
}

function parseTilePalette(raw: unknown): TileDef[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: TileDef[] = []
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue
    const o = t as Record<string, unknown>
    const id = Number(o.id)
    if (!Number.isFinite(id) || id < 1) continue
    const entry: TileDef = {
      id,
      name: String(o.name ?? `Tile ${id}`),
      color: String(o.color ?? '#9CA3AF'),
      solid: Boolean(o.solid),
    }
    if (typeof o.groundClass === 'string' && o.groundClass.length > 0)
      entry.groundClass = o.groundClass
    const sk = o.surfaceKind
    if (sk === 'solid' || sk === 'oneWay') entry.surfaceKind = sk
    out.push(entry)
  }
  return out.length ? out : undefined
}

function parseLayerParallax(raw: unknown): SceneLayerSettings['parallax'] {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const x = Number(r.x)
  const y = Number(r.y)
  const px = Number.isFinite(x) ? x : 1
  const py = Number.isFinite(y) ? y : 1
  // Omit the neutral default so project.json stays lean.
  return px === 1 && py === 1 ? undefined : { x: px, y: py }
}

function parseLayerBackground(raw: unknown): SceneLayerSettings['background'] {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const imageId = String(r.imageId ?? r.image_id ?? '').trim()
  if (!imageId) return undefined
  const scrollX = Number(r.scrollX ?? r.scroll_x)
  const scrollY = Number(r.scrollY ?? r.scroll_y)
  return {
    imageId,
    tileX: r.tileX !== false && r.tile_x !== false,
    tileY: r.tileY !== false && r.tile_y !== false,
    scrollX: Number.isFinite(scrollX) ? scrollX : 0,
    scrollY: Number.isFinite(scrollY) ? scrollY : 0,
  }
}

/** Parse the global render layer stack ({id,name,locked} per layer). */
function parseLayers(raw: unknown): LayerDef[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: LayerDef[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  for (const item of raw) {
    const isObj = !!item && typeof item === 'object'
    const obj = isObj ? (item as Record<string, unknown>) : undefined
    const name =
      typeof item === 'string'
        ? item
        : obj
          ? String(obj.name ?? '')
          : ''
    const trimmedName = name.trim()
    if (!trimmedName || seenNames.has(trimmedName)) continue
    let id = obj?.id != null ? String(obj.id).trim() : ''
    if (!id || seenIds.has(id)) id = newLayerId()
    seenIds.add(id)
    seenNames.add(trimmedName)
    const layer: LayerDef = { id, name: trimmedName }
    if (obj?.locked === true) layer.locked = true
    out.push(layer)
  }
  return out.length ? out : undefined
}

/** Parse one layer's per-scene visual settings (visible/opacity/parallax/background). */
function parseSceneLayerSettings(raw: unknown): SceneLayerSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: SceneLayerSettings = {}
  if (r.visible === false) out.visible = false
  const opacity = Number(r.opacity)
  if (Number.isFinite(opacity) && opacity >= 0 && opacity < 1) out.opacity = opacity
  const parallax = parseLayerParallax(r.parallax)
  if (parallax) out.parallax = parallax
  const background = parseLayerBackground(r.background)
  if (background) out.background = background
  return Object.keys(out).length > 0 ? out : undefined
}

/** Parse the per-scene layerSettings map keyed by LayerId. */
function parseLayerSettingsMap(raw: unknown): Record<LayerId, SceneLayerSettings> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<LayerId, SceneLayerSettings> = {}
  for (const [layerId, value] of Object.entries(raw as Record<string, unknown>)) {
    const settings = parseSceneLayerSettings(value)
    if (settings) out[layerId] = settings
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export interface ParseProjectDocResult {
  project: ProjectDoc
  logicBoardLoadIssues: LogicBoardLoadIssue[]
}

/**
 * Parse a project.json string produced by the C++ runtime.
 * Handles Vec2/Vec4 as either `[x,y]` arrays or `{x,y}` objects.
 * Returns null if the JSON is invalid or missing required fields.
 */
export function parseProjectDocWithMeta(jsonStr: string): ParseProjectDocResult | null {
  try {
    const raw = JSON.parse(jsonStr) as Record<string, unknown>
    const unsupportedFormat = unsupportedProjectFormatMessage(jsonStr)
    if (unsupportedFormat) throw new Error(unsupportedFormat)

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

    const objectTypesRaw = raw.objectTypes ?? raw.object_types
    const objectTypes: Record<string, ObjectTypeDef> = {}
    if (objectTypesRaw && typeof objectTypesRaw === 'object' && !Array.isArray(objectTypesRaw)) {
      for (const [key, value] of Object.entries(objectTypesRaw as object)) {
        const ot = parseObjectType(value, key)
        if (ot) objectTypes[ot.id] = ot
      }
    }

    const formatVersion = Number(raw.formatVersion ?? raw.format_version) || undefined

    const logicBoardsParsed: ParseLogicBoardsResult = parseLogicBoardsWithIssues(
      raw.logicBoards ?? raw.logic_boards,
    )

    const base: ProjectDoc = {
      projectName:    String(raw.projectName ?? raw.project_name ?? 'Untitled'),
      version:        String(raw.version ?? '1.0.0'),
      ...(formatVersion ? { formatVersion } : {}),
      licenseTier:    (() => {
                       const tier = String(raw.licenseTier ?? raw.license_tier ?? 'free')
                       return tier === 'pro' ? 'pro' : 'free'
                     })(),
      targetFPS:      Number(raw.targetFPS ?? raw.target_fps ?? 60),
      activeSceneId:  String(raw.activeSceneId ?? raw.active_scene_id ?? firstSceneId),
      mainScriptPath: String(raw.mainScriptPath ?? raw.main_script_path ?? 'scripts/main.lua'),
      ...(Object.keys(objectTypes).length > 0 ? { objectTypes } : {}),
      entities,
      scenes,
      thumbnails:     raw.thumbnails && typeof raw.thumbnails === 'object'
                       ? Object.fromEntries(Object.entries(raw.thumbnails as Record<string, unknown>).map(
                           ([key, value]) => [key, String(value)]
                         ))
                       : undefined,
      world:          parseWorld(raw.world),
      tilePalette:    parseTilePalette(raw.tilePalette ?? raw.tile_palette),
      tilesets:       parseTilesets(raw.tilesets),
      assets:         parseAssets(raw.assets),
      audioAssets:    parseAudioAssets(raw.audioAssets ?? raw.audio_assets),
      fontAssets:     parseFontAssets(raw.fontAssets ?? raw.font_assets),
      assetVirtualFolders: parseAssetVirtualFolders(
        raw.assetVirtualFolders ?? raw.asset_virtual_folders,
      ),
      logicBoards:    logicBoardsParsed.doc,
      globalVariables: parseVariableDefinitions(raw.globalVariables ?? raw.global_variables),
      layers:         parseLayers(raw.layers),
    }

    const { project } = normalizeProjectDoc(base)
    return { project, logicBoardLoadIssues: logicBoardsParsed.issues }
  } catch (err) {
    console.error('[project-codec] Failed to parse project.json:', err)
    return null
  }
}

export function parseProjectDoc(jsonStr: string): ProjectDoc | null {
  return parseProjectDocWithMeta(jsonStr)?.project ?? null
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

function vec3Array(v: Vec3): [number, number, number] {
  return [v.x, v.y, v.z]
}

function serializeSprite(sprite: SpriteComponent) {
  const base = {
    spriteAssetId: sprite.spriteAssetId,
    tint:          vec4Array(sprite.tint),
    fillColor:     vec3Array(sprite.fillColor),
    alpha:         sprite.alpha,
    renderOrder:   sprite.renderOrder,
    ...(sprite.defaultClip?.trim()
      ? { defaultClip: sprite.defaultClip.trim() }
      : {}),
    ...(sprite.playClipOnSpawn === true ? { playClipOnSpawn: true } : {}),
  }
  if (sprite.pivotFromAsset === false) {
    return {
      ...base,
      pivotFromAsset: false,
      pivot: vec2Array(sprite.pivot),
    }
  }
  return { ...base, pivotFromAsset: true }
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
    ...(entity.physics ? { physics: entity.physics } : {}),
    ...(entity.visible === false ? { visible: false } : {}),
    ...(entity.localVariables?.length ? { localVariables: entity.localVariables } : {}),
    ...(entity.localVariableOverrides && Object.keys(entity.localVariableOverrides).length
      ? { localVariableOverrides: entity.localVariableOverrides }
      : {}),
    ...Object.fromEntries(
      COMPONENT_KEYS
        .filter((k) => (entity as unknown as Record<string, unknown>)[k])
        .map((k) => [k, (entity as unknown as Record<string, unknown>)[k]]),
    ),
  }
}

function serializeInstance(inst: SceneInstanceDef) {
  return {
    id: inst.id,
    objectTypeId: inst.objectTypeId,
    ...(inst.instanceName ? { instanceName: inst.instanceName } : {}),
    transform: serializeTransform(inst.transform),
    ...(inst.visible === false ? { visible: false } : {}),
    ...(inst.layerId ? { layerId: inst.layerId } : {}),
    ...(inst.localVariableOverrides && Object.keys(inst.localVariableOverrides).length
      ? { localVariableOverrides: inst.localVariableOverrides }
      : {}),
  }
}

function serializeObjectType(type: ObjectTypeDef) {
  const base = serializeEntity({
    id: 0,
    name: type.displayName,
    className: type.id,
    tags: type.tags,
    transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
    sprite: type.sprite,
    animation: type.animation,
    physics: type.physics,
    scriptPath: type.scriptPath,
    visible: type.visible,
    ...(Object.fromEntries(
      COMPONENT_KEYS
        .filter((k) => (type as unknown as Record<string, unknown>)[k])
        .map((k) => [k, (type as unknown as Record<string, unknown>)[k]]),
    ) as Partial<EntityDef>),
  })
  const { id: _id, name: _n, className: _c, transform: _t, ...rest } = base
  return {
    id: type.id,
    displayName: type.displayName,
    ...rest,
    ...(type.defaultLogicBoardId ? { defaultLogicBoardId: type.defaultLogicBoardId } : {}),
    ...(type.localVariables?.length ? { localVariables: type.localVariables } : {}),
  }
}

function serializeScene(scene: SceneDef) {
  const tilemapLayers = scene.tilemapLayers
  return {
    id:              scene.id,
    name:            scene.name,
    worldSize:       vec2Array(scene.worldSize),
    viewportSize:    vec2Array(scene.viewportSize),
    ...(scene.cameraStart ? { cameraStart: vec2Array(scene.cameraStart) } : {}),
    backgroundColor: vec4Array(scene.backgroundColor),
    ...(scene.instances?.length
      ? { instances: scene.instances.map(serializeInstance) }
      : { entityIds: scene.entityIds }),
    ...(scene.tilemap ? { tilemap: serializeTilemapLayer(scene.tilemap) } : {}),
    ...(tilemapLayers && Object.keys(tilemapLayers).length > 0
      ? {
          tilemapLayers: Object.fromEntries(
            Object.entries(tilemapLayers).map(([layerId, layer]) => [
              layerId,
              serializeTilemapLayer(layer),
            ]),
          ),
        }
      : {}),
    ...(scene.layerSettings && Object.keys(scene.layerSettings).length > 0
      ? { layerSettings: scene.layerSettings }
      : {}),
  }
}

export function serializeProjectDoc(project: ProjectDoc): string {
  const v2 = projectForSave(project)
  const objectTypes = Object.fromEntries(
    Object.values(v2.objectTypes ?? {})
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => [t.id, serializeObjectType(t)]),
  )
  const scenes = Object.fromEntries(
    Object.values(v2.scenes)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(scene => [scene.id, serializeScene(scene)])
  )

  const json = {
    projectName:    v2.projectName,
    version:        v2.version,
    formatVersion:  PROJECT_FORMAT_V3,
    licenseTier:    project.licenseTier ?? 'free',
    ...(project.world ? { world: project.world } : {}),
    ...(project.tilePalette && project.tilePalette.length > 0
      ? { tilePalette: project.tilePalette }
      : {}),
    ...(project.tilesets && Object.keys(project.tilesets).length > 0
      ? {
          tilesets: Object.fromEntries(
            Object.values(project.tilesets).map((t) => {
              const { previewDataUrl: _drop, ...persisted } = t
              return [t.assetId, persisted]
            }),
          ),
        }
      : {}),
    ...(project.assets && Object.keys(project.assets).length > 0
      ? {
          assets: Object.fromEntries(
            Object.values(project.assets).map((a) => {
              // Drop transient dataUrl; persist imagePoints + clips when set.
              const out: Record<string, unknown> = {
                id: a.id, name: a.name, path: a.path, usage: a.usage,
              }
              if (a.contentHash)
                out.contentHash = a.contentHash
              if (a.imagePoints && a.imagePoints.length > 0)
                out.imagePoints = a.imagePoints
              if (a.clips && a.clips.length > 0)
                out.clips = a.clips
              if (a.defaultPivot != null)
                out.defaultPivot = vec2Array(a.defaultPivot)
              return [a.id, out]
            }),
          ),
        }
      : {}),
    ...(project.audioAssets && Object.keys(project.audioAssets).length > 0
      ? { audioAssets: project.audioAssets }
      : {}),
    ...(project.fontAssets && Object.keys(project.fontAssets).length > 0
      ? { fontAssets: project.fontAssets }
      : {}),
    ...(project.assetVirtualFolders &&
    Object.keys(project.assetVirtualFolders).length > 0
      ? { assetVirtualFolders: project.assetVirtualFolders }
      : {}),
    targetFPS:      v2.targetFPS,
    activeSceneId:  v2.activeSceneId,
    mainScriptPath: v2.mainScriptPath,
    objectTypes,
    scenes,
    ...(v2.thumbnails ? { thumbnails: v2.thumbnails } : {}),
    ...(v2.logicBoards && v2.logicBoards.length > 0
      ? { logicBoards: v2.logicBoards }
      : {}),
    ...(v2.globalVariables?.length ? { globalVariables: v2.globalVariables } : {}),
    ...(project.layers && project.layers.length > 0 ? { layers: project.layers } : {}),
  }

  return `${JSON.stringify(json, null, 2)}\n`
}
