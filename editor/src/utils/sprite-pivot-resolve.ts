import type { ImageAsset, ProjectDoc, SpriteComponent, Vec2 } from '../types'
import { clipExistsOnSpritePath } from './animation-clips-catalog'
import {
  clampPivot,
  DEFAULT_PIVOT,
  pivotsEqual,
} from './sprite-pivot'

export { DEFAULT_PIVOT }

export function usesAssetPivot(sprite: SpriteComponent): boolean {
  return sprite.pivotFromAsset !== false
}

export function findImageAssetByPath(
  assets: Record<string, ImageAsset> | undefined,
  spritePath: string,
): ImageAsset | undefined {
  if (!assets || !spritePath) return undefined
  const byPath = Object.values(assets).find((a) => a.path === spritePath)
  if (byPath) return byPath
  return assets[spritePath]
}

export function getAssetDefaultPivot(asset: ImageAsset | undefined): Vec2 {
  if (!asset?.defaultPivot) return { ...DEFAULT_PIVOT }
  return clampPivot(asset.defaultPivot)
}

export function resolveEffectivePivot(
  sprite: SpriteComponent,
  assets: Record<string, ImageAsset> | undefined,
): Vec2 {
  if (!usesAssetPivot(sprite)) {
    return clampPivot(sprite.pivot)
  }
  return getAssetDefaultPivot(findImageAssetByPath(assets, sprite.spriteAssetId))
}

export function spriteAssignedFromAsset(
  sprite: SpriteComponent,
  asset: ImageAsset | undefined,
  project?: ProjectDoc | null,
): SpriteComponent {
  const spriteAssetId = asset?.path ?? ''
  const defaultClip =
    sprite.defaultClip &&
    clipExistsOnSpritePath(project, spriteAssetId, sprite.defaultClip)
      ? sprite.defaultClip
      : undefined
  return {
    ...sprite,
    spriteAssetId,
    pivotFromAsset: true,
    pivot: getAssetDefaultPivot(asset),
    defaultClip,
    playClipOnSpawn: defaultClip ? sprite.playClipOnSpawn === true : false,
  }
}

export function spriteWithPivotOverride(
  sprite: SpriteComponent,
  pivot: Vec2,
): SpriteComponent {
  return {
    ...sprite,
    pivotFromAsset: false,
    pivot: clampPivot(pivot),
  }
}

export function spriteInheritingAssetPivot(sprite: SpriteComponent): SpriteComponent {
  return {
    ...sprite,
    pivotFromAsset: true,
  }
}

export function isPivotOverride(
  sprite: SpriteComponent,
  assets: Record<string, ImageAsset> | undefined,
): boolean {
  if (usesAssetPivot(sprite)) return false
  const assetPivot = resolveEffectivePivot(
    { ...sprite, pivotFromAsset: true },
    assets,
  )
  return !pivotsEqual(sprite.pivot, assetPivot)
}

export function withResolvedSpritePivot(
  entity: { sprite: SpriteComponent },
  assets: Record<string, ImageAsset> | undefined,
): { sprite: SpriteComponent } {
  const pivot = resolveEffectivePivot(entity.sprite, assets)
  if (pivotsEqual(pivot, entity.sprite.pivot)) return entity
  return {
    ...entity,
    sprite: { ...entity.sprite, pivot },
  }
}

export function resolveEntitiesForRuntime(
  entities: Record<number, import('../types').EntityDef>,
  assets: Record<string, ImageAsset> | undefined,
): Record<number, import('../types').EntityDef> {
  const out: Record<number, import('../types').EntityDef> = {}
  for (const [id, ent] of Object.entries(entities)) {
    out[Number(id)] = withResolvedSpritePivot(ent, assets) as import('../types').EntityDef
  }
  return out
}

export function resolveProjectEntitiesForRuntime(project: ProjectDoc): ProjectDoc {
  const entities = resolveEntitiesForRuntime(project.entities, project.assets)
  const objectTypes = project.objectTypes
    ? Object.fromEntries(
        Object.entries(project.objectTypes).map(([k, t]) => [
          k,
          {
            ...t,
            sprite: withResolvedSpritePivot({ sprite: t.sprite }, project.assets).sprite,
          },
        ]),
      )
    : undefined
  return { ...project, entities, ...(objectTypes ? { objectTypes } : {}) }
}
