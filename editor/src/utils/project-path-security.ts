import type { ProjectDoc } from '../types'
import { imageAssetForRef } from './resolve-image-load-key'
import { isPathLikeAssetRef, isStableImageAssetRef } from './asset-ref-contract'

const ABSOLUTE_PATH_RE = /^(?:[a-zA-Z]:[/\\]|[/\\]|\\\\)/
const CONTROL_CHAR_RE = /[\u0000-\u001f]/

export function normalizeProjectRelativePath(path: string, label = 'path'): string {
  const trimmed = path.trim()
  if (!trimmed) {
    throw new Error(`${label} must be a non-empty project-relative path.`)
  }
  if (CONTROL_CHAR_RE.test(trimmed)) {
    throw new Error(`${label} contains control characters.`)
  }
  if (ABSOLUTE_PATH_RE.test(trimmed)) {
    throw new Error(`${label} must be relative to the project folder.`)
  }

  const parts = trimmed.replace(/\\/g, '/').split('/')
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new Error(`${label} may not contain empty, "." or ".." path segments.`)
  }

  return parts.join('/')
}

export function assertProjectPathsSafe(project: ProjectDoc): void {
  normalizeProjectRelativePath(project.mainScriptPath, 'mainScriptPath')

  for (const entity of Object.values(project.entities)) {
    if (entity.scriptPath) {
      normalizeProjectRelativePath(entity.scriptPath, `entity "${entity.name}" scriptPath`)
    }
    const spriteRef = entity.sprite?.spriteAssetId?.trim()
    if (spriteRef && isPathLikeAssetRef(spriteRef) && !isStableImageAssetRef(project, spriteRef)) {
      normalizeProjectRelativePath(spriteRef, `entity "${entity.name}" spriteAssetId`)
    }
  }

  for (const type of Object.values(project.objectTypes ?? {})) {
    const spriteRef = type.sprite?.spriteAssetId?.trim()
    if (spriteRef && isPathLikeAssetRef(spriteRef) && !isStableImageAssetRef(project, spriteRef)) {
      normalizeProjectRelativePath(spriteRef, `object type "${type.displayName}" spriteAssetId`)
    }
  }

  for (const asset of Object.values(project.assets ?? {})) {
    normalizeProjectRelativePath(asset.path, `asset "${asset.name}" path`)
  }

  for (const asset of Object.values(project.audioAssets ?? {})) {
    normalizeProjectRelativePath(asset.path, `audio asset "${asset.name}" path`)
  }

  for (const asset of Object.values(project.fontAssets ?? {})) {
    normalizeProjectRelativePath(asset.path, `font asset "${asset.name}" path`)
  }

  for (const tileset of Object.values(project.tilesets ?? {})) {
    if (tileset.spriteImagePath) {
      normalizeProjectRelativePath(
        tileset.spriteImagePath,
        `tileset "${tileset.name}" spriteImagePath`,
      )
    }
  }

  for (const [sceneId, path] of Object.entries(project.thumbnails ?? {})) {
    normalizeProjectRelativePath(path, `thumbnail "${sceneId}" path`)
  }
}
