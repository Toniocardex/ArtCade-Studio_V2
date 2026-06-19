import type { ImageAssetUsage, ProjectDoc } from '../types'
import { IMAGE_ASSET_USAGE_LABELS, IMAGE_ASSET_USAGES } from '../types'
import { findLogicBoardForInstance } from './project'

export type AssetFolderId = 'audio' | 'fonts' | 'images' | 'scripts' | 'tilesets'

export type ExplorerSceneRow = Readonly<{
  sceneId: string
  name: string
  isStartScene: boolean
}>

export type ExplorerEntityRow = Readonly<{
  entityId: number
  name: string
  hasLogic: boolean
  visible: boolean
}>

export type ExplorerTypeGroup = Readonly<{
  /** Stable key for expand state: the object type id, or `class:<className>` for legacy entities without an instance. */
  typeKey: string
  /** Object type id when the group maps to an ObjectTypeDef; null for legacy class-based groups. */
  objectTypeId: string | null
  displayName: string
  instances: ExplorerEntityRow[]
}>

export type ExplorerScriptRow = Readonly<{
  path: string
  label: string
}>

export type ExplorerImageRow = Readonly<{
  id: string
  name: string
  path: string
  usage: ImageAssetUsage
}>

export type ExplorerImageUsageGroup = Readonly<{
  usage: ImageAssetUsage
  label: string
  images: ExplorerImageRow[]
}>

export type ExplorerAudioRow = Readonly<{
  id: string
  name: string
  path: string
}>

export type ExplorerFontRow = Readonly<{
  id: string
  name: string
  path: string
}>

export type ExplorerTilesetRow = Readonly<{
  assetId: string
  name: string
}>

export type ExplorerAssetFolder = Readonly<{
  id: AssetFolderId
  label: string
  count: number
  images: ExplorerImageRow[]
  imageUsageGroups: ExplorerImageUsageGroup[]
  audio: ExplorerAudioRow[]
  fonts: ExplorerFontRow[]
  scripts: ExplorerScriptRow[]
  tilesets: ExplorerTilesetRow[]
}>

export type ProjectExplorerData = Readonly<{
  scenes: ExplorerSceneRow[]
  /** Scene objects grouped by object type (Construct-style: scene rows are instances of types). */
  entityGroups: ExplorerTypeGroup[]
  assetFolders: ExplorerAssetFolder[]
  hasSearch: boolean
  scenesVisible: boolean
  entitiesVisible: boolean
  assetsVisible: boolean
}>

export function normalizeExplorerQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function matchesExplorerQuery(query: string, ...fields: (string | number | undefined | null)[]): boolean {
  const q = normalizeExplorerQuery(query)
  if (!q) return true
  return fields.some((f) => {
    if (f == null) return false
    return String(f).toLowerCase().includes(q)
  })
}

function collectScriptPaths(project: ProjectDoc, extraPaths: readonly string[]): ExplorerScriptRow[] {
  const paths = new Set<string>()
  if (project.mainScriptPath) paths.add(project.mainScriptPath)
  for (const p of extraPaths) {
    if (p) paths.add(p)
  }
  for (const e of Object.values(project.entities)) {
    if (e.scriptPath) paths.add(e.scriptPath)
  }
  return [...paths]
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({
      path,
      label: path.split('/').pop() ?? path,
    }))
}

export function buildProjectExplorerData(
  project: ProjectDoc,
  activeSceneId: string,
  searchQuery: string,
  extraScriptPaths: readonly string[] = [],
): ProjectExplorerData {
  const q = searchQuery

  const scenesAll = Object.values(project.scenes)
    .map((s) => ({
      sceneId: s.id,
      name: s.name,
      isStartScene: s.id === project.activeSceneId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const scenes = scenesAll.filter((s) =>
    matchesExplorerQuery(q, s.name, s.sceneId, 'scene', 'scenes'),
  )

  const entityGroups = buildSceneTypeGroups(project, activeSceneId, q)

  const imagesAll = Object.values(project.assets ?? {}).map((a) => ({
    id: a.id,
    name: a.name,
    path: a.path,
    usage: a.usage,
  }))
  const audioAll = Object.values(project.audioAssets ?? {}).map((a) => ({
    id: a.id,
    name: a.name,
    path: a.path,
  }))
  const fontsAll = Object.values(project.fontAssets ?? {}).map((a) => ({
    id: a.id,
    name: a.name,
    path: a.path,
  }))
  const tilesetsAll = Object.values(project.tilesets ?? {}).map((t) => ({
    assetId: t.assetId,
    name: t.name,
  }))
  const scriptsAll = collectScriptPaths(project, extraScriptPaths)

  const folderDefs: ReadonlyArray<{ id: AssetFolderId; label: string }> = [
    { id: 'audio', label: 'Audio' },
    { id: 'fonts', label: 'Fonts' },
    { id: 'images', label: 'Images' },
    { id: 'scripts', label: 'Scripts' },
    { id: 'tilesets', label: 'Tilesets' },
  ]

  const assetFolders: ExplorerAssetFolder[] = folderDefs.map(({ id, label }) => {
    const images = imagesAll
      .filter((row) => matchesExplorerQuery(q, row.name, row.path, row.id, label, 'images', 'image'))
      .sort((a, b) => a.name.localeCompare(b.name))
    const imageUsageGroups = IMAGE_ASSET_USAGES.map((usage) => ({
      usage,
      label: IMAGE_ASSET_USAGE_LABELS[usage],
      images: images.filter((row) => row.usage === usage),
    }))
    const audio = audioAll
      .filter((row) => matchesExplorerQuery(q, row.name, row.path, row.id, label, 'audio'))
      .sort((a, b) => a.name.localeCompare(b.name))
    const fonts = fontsAll
      .filter((row) => matchesExplorerQuery(q, row.name, row.path, row.id, label, 'fonts', 'font'))
      .sort((a, b) => a.name.localeCompare(b.name))
    const scripts = scriptsAll
      .filter((row) => matchesExplorerQuery(q, row.label, row.path, label, 'scripts', 'script', 'lua'))
      .sort((a, b) => a.label.localeCompare(b.label))
    const tilesets = tilesetsAll
      .filter((row) => matchesExplorerQuery(q, row.name, row.assetId, label, 'tilesets', 'tileset'))
      .sort((a, b) => a.name.localeCompare(b.name))

    const count =
      id === 'audio' ? audio.length
      : id === 'fonts' ? fonts.length
      : id === 'images' ? images.length
      : id === 'scripts' ? scripts.length
      : tilesets.length

    return {
      id,
      label,
      count,
      images: id === 'images' ? images : [],
      imageUsageGroups: id === 'images' ? imageUsageGroups : [],
      audio: id === 'audio' ? audio : [],
      fonts: id === 'fonts' ? fonts : [],
      scripts: id === 'scripts' ? scripts : [],
      tilesets: id === 'tilesets' ? tilesets : [],
    }
  }).filter((folder) => {
    if (!normalizeExplorerQuery(q)) return true
    const hasChildren = folder.count > 0
    const nameMatch = matchesExplorerQuery(q, folder.label, folder.id)
    return hasChildren || nameMatch
  })

  const hasSearch = normalizeExplorerQuery(q).length > 0

  return {
    scenes,
    entityGroups,
    assetFolders,
    hasSearch,
    scenesVisible: scenes.length > 0 || !hasSearch,
    entitiesVisible: entityGroups.length > 0 || !hasSearch,
    assetsVisible: assetFolders.length > 0 || !hasSearch,
  }
}

/**
 * Groups the active scene's objects by object type for the explorer tree.
 * Entities without a matching scene instance (legacy projects) fall back to a
 * per-className group. Groups whose display name matches the query keep all
 * instances; otherwise instances are filtered individually.
 * @param project        loaded project document
 * @param activeSceneId  scene whose instances are listed
 * @param searchQuery    raw explorer search text (empty = no filtering)
 */
export function buildSceneTypeGroups(
  project: ProjectDoc,
  activeSceneId: string,
  searchQuery: string,
): ExplorerTypeGroup[] {
  const scene = project.scenes[activeSceneId]
  const instanceTypeById = new Map<number, string>()
  for (const inst of scene?.instances ?? []) {
    instanceTypeById.set(inst.id, inst.objectTypeId)
  }

  const groups = new Map<string, {
    typeKey: string
    objectTypeId: string | null
    displayName: string
    instances: ExplorerEntityRow[]
  }>()

  for (const id of scene?.entityIds ?? []) {
    const entity = project.entities[id]
    if (!entity) continue
    const objectTypeId = instanceTypeById.get(id) ?? null
    const typeKey = objectTypeId ?? `class:${entity.className}`
    let group = groups.get(typeKey)
    if (!group) {
      const displayName = objectTypeId
        ? project.objectTypes?.[objectTypeId]?.displayName ?? objectTypeId
        : entity.className
      group = { typeKey, objectTypeId, displayName, instances: [] }
      groups.set(typeKey, group)
    }
    group.instances.push({
      entityId: entity.id,
      name: entity.name,
      hasLogic: Boolean(findLogicBoardForInstance(project, entity.id)),
      visible: entity.visible !== false,
    })
  }

  return [...groups.values()]
    .map((group) => {
      const keepAll = matchesExplorerQuery(
        searchQuery,
        group.displayName,
        group.typeKey,
        'entity',
        'entities',
        'object',
        'objects',
      )
      const instances = (keepAll
        ? [...group.instances]
        : group.instances.filter((row) =>
            matchesExplorerQuery(searchQuery, row.name, String(row.entityId)),
          )
      ).sort((a, b) => a.name.localeCompare(b.name))
      return { ...group, instances }
    })
    .filter((group) => group.instances.length > 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function assetFolderItemCount(folder: ExplorerAssetFolder): number {
  return folder.images.length + folder.audio.length + folder.fonts.length
    + folder.scripts.length + folder.tilesets.length
}
