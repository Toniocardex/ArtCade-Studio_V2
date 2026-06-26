import type {
  CollisionShapeDef,
  CollisionShapeRole,
  EntityDef,
  ProjectDoc,
} from '../types'
import type { CollisionProfileDef } from '../types/index'
import { findImageAssetByPath } from './sprite-pivot-resolve'

export const PLAYER_MASK_LAYERS = ['ground', 'hazard', 'pickup', 'interaction'] as const
export const GROUND_MASK_LAYERS = ['player', 'enemy', 'projectile'] as const

export function defaultPlayerCollisionShape(): CollisionShapeDef {
  return {
    type: 'rectangle',
    response: 'solid',
    role: 'body',
    layerId: 'player',
    maskLayerIds: [...PLAYER_MASK_LAYERS],
    offsetX: 0.1,
    offsetY: 0.1,
    width: 0.8,
    height: 0.8,
    radius: 16,
    enabled: true,
    oneWay: false,
    friction: 0.2,
    restitution: 0,
    density: 1,
  }
}

export function defaultGroundCollisionShape(): CollisionShapeDef {
  return {
    type: 'rectangle',
    response: 'solid',
    role: 'body',
    layerId: 'ground',
    maskLayerIds: [...GROUND_MASK_LAYERS],
    offsetX: 0,
    offsetY: 0,
    width: 1,
    height: 1,
    radius: 16,
    enabled: true,
    oneWay: false,
    friction: 0.3,
    restitution: 0,
    density: 1,
  }
}

export function createDefaultCollisionProfile(
  assetId: string,
  assetName: string,
  role: 'player' | 'ground' = 'player',
): CollisionProfileDef {
  return {
    id: assetId,
    name: assetName,
    coordinateSpace: 'frame-normalized',
    shapes: [role === 'ground' ? defaultGroundCollisionShape() : defaultPlayerCollisionShape()],
  }
}

export function getCollisionProfile(
  project: ProjectDoc | null | undefined,
  profileId: string,
): CollisionProfileDef | undefined {
  return project?.collisionProfiles?.[profileId]
}

export function getOrCreateCollisionProfile(
  project: ProjectDoc,
  assetId: string,
  assetName: string,
  role: 'player' | 'ground' = 'player',
): CollisionProfileDef {
  const existing = project.collisionProfiles?.[assetId]
  if (existing) return existing
  return createDefaultCollisionProfile(assetId, assetName, role)
}

/**
 * Resolves the collision profile id for an entity (explicit profileId or linked sprite asset).
 */
export function resolveCollisionProfileId(
  entity: EntityDef,
  project: ProjectDoc | null | undefined,
): string | undefined {
  const body = entity.collisionBody
  if (!body) return undefined
  if (body.profileId?.trim()) return body.profileId.trim()
  const spritePath = entity.sprite?.spriteAssetId
  if (!spritePath?.trim() || !project?.assets) return undefined
  const asset = findImageAssetByPath(project.assets, spritePath)
  return asset?.id
}

export function resolveCollisionProfileForEntity(
  entity: EntityDef,
  project: ProjectDoc | null | undefined,
): CollisionProfileDef | undefined {
  const profileId = resolveCollisionProfileId(entity, project)
  if (!profileId) return undefined
  return getCollisionProfile(project, profileId)
}

export function inferProfileRoleForAsset(
  project: ProjectDoc,
  assetId: string,
): 'player' | 'ground' {
  const asset = project.assets?.[assetId]
  if (!asset) return 'player'
  for (const entity of Object.values(project.entities ?? {})) {
    if (entity.sprite?.spriteAssetId !== asset.id) continue
    if (entity.tags?.includes('player')) return 'player'
  }
  for (const type of Object.values(project.objectTypes ?? {})) {
    if (type.sprite?.spriteAssetId === asset.id) continue
    if (type.tags?.includes('player')) return 'player'
  }
  return asset.usage === 'sprite' ? 'player' : 'ground'
}

export function resolvedCollisionShapes(
  entity: EntityDef,
  project: ProjectDoc | null | undefined,
): CollisionShapeDef[] {
  const body = entity.collisionBody
  if (!body?.enabled) return []
  const profile = resolveCollisionProfileForEntity(entity, project)
  if (profile?.shapes?.length) return profile.shapes
  return body.shapes ?? []
}

export function formatShapeRoleLabel(role: CollisionShapeRole): string {
  switch (role) {
    case 'feet': return 'Feet'
    case 'hurtbox': return 'Hurtbox'
    case 'hitbox': return 'Hitbox'
    case 'interaction': return 'Interaction'
    case 'body':
    default: return 'Body'
  }
}

export function physicsLayerOptions(
  project: ProjectDoc | null | undefined,
): ReadonlyArray<{ id: string; name: string }> {
  const layers = project?.physics?.layers ?? []
  if (layers.length === 0) {
    return [
      { id: 'default', name: 'Default' },
      { id: 'player', name: 'Player' },
      { id: 'ground', name: 'Ground' },
      { id: 'enemy', name: 'Enemy' },
      { id: 'pickup', name: 'Pickup' },
      { id: 'hazard', name: 'Hazard' },
      { id: 'projectile', name: 'Projectile' },
      { id: 'interaction', name: 'Interaction' },
    ]
  }
  return layers.map((layer) => ({ id: layer.id, name: layer.name }))
}

export function patchCollisionProfile(
  project: ProjectDoc,
  assetId: string,
  patch: Partial<CollisionProfileDef>,
): ProjectDoc {
  const existing = project.collisionProfiles?.[assetId]
  const nextProfile: CollisionProfileDef = {
    ...(existing ?? createDefaultCollisionProfile(assetId, patch.name ?? assetId)),
    ...patch,
    id: assetId,
  }
  return {
    ...project,
    collisionProfiles: {
      ...(project.collisionProfiles ?? {}),
      [assetId]: nextProfile,
    },
  }
}

export function patchCollisionProfileShape(
  profile: CollisionProfileDef,
  shapeIndex: number,
  patch: Partial<CollisionShapeDef>,
): CollisionProfileDef {
  const shapes = [...(profile.shapes ?? [])]
  if (shapeIndex < 0 || shapeIndex >= shapes.length) return profile
  shapes[shapeIndex] = { ...shapes[shapeIndex], ...patch }
  return { ...profile, shapes }
}

export function addCollisionProfileShape(
  profile: CollisionProfileDef,
  shape?: Partial<CollisionShapeDef>,
): CollisionProfileDef {
  const base = defaultPlayerCollisionShape()
  return {
    ...profile,
    shapes: [...(profile.shapes ?? []), { ...base, ...shape }],
  }
}

export function removeCollisionProfileShape(
  profile: CollisionProfileDef,
  shapeIndex: number,
): CollisionProfileDef {
  const shapes = (profile.shapes ?? []).filter((_, i) => i !== shapeIndex)
  return { ...profile, shapes }
}
