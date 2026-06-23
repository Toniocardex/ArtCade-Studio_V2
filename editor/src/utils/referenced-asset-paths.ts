import type { ProjectDoc } from '../types'

/**
 * Every project-relative file path the project references (images, audio,
 * fonts, tileset sheets). Used both to decide which staged bytes must reach
 * disk on save and which staged bytes are still needed across a project load.
 */
export function referencedAssetPaths(project: ProjectDoc): Set<string> {
  const out = new Set<string>()
  const add = (path: string | undefined): void => {
    const trimmed = path?.trim()
    if (trimmed) out.add(trimmed)
  }
  for (const asset of Object.values(project.assets ?? {})) add(asset.path)
  for (const asset of Object.values(project.audioAssets ?? {})) add(asset.path)
  for (const asset of Object.values(project.fontAssets ?? {})) add(asset.path)
  for (const tileset of Object.values(project.tilesets ?? {})) add(tileset.spriteImagePath)
  return out
}
