import type { ProjectDoc } from '../types'
import { allObjectTypeIds, findLogicBoardForInstance, objectTypeDisplayLabel } from './project'

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

export type ExplorerEntityTypeRow = Readonly<{
  objectTypeId: string
  label: string
}>

export type ExplorerScriptRow = Readonly<{
  path: string
  label: string
}>

export type ExplorerImageRow = Readonly<{
  id: string
  name: string
  path: string
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
  audio: ExplorerAudioRow[]
  fonts: ExplorerFontRow[]
  scripts: ExplorerScriptRow[]
  tilesets: ExplorerTilesetRow[]
}>

export type ProjectExplorerData = Readonly<{
  scenes: ExplorerSceneRow[]
  entities: ExplorerEntityRow[]
  entityTypes: ExplorerEntityTypeRow[]
  assetFolders: ExplorerAssetFolder[]
  hasSearch: boolean
  scenesVisible: boolean
  entitiesVisible: boolean
  entityTypesVisible: boolean
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

  const scene = project.scenes[activeSceneId]
  const entitiesAll = (scene?.entityIds ?? [])
    .map((id) => project.entities[id])
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => ({
      entityId: e.id,
      name: e.name,
      hasLogic: Boolean(findLogicBoardForInstance(project, e.id)),
      visible: e.visible !== false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const entities = entitiesAll.filter((e) =>
    matchesExplorerQuery(q, e.name, String(e.entityId), 'entity', 'entities'),
  )

  const entityTypesAll = allObjectTypeIds(project).map((objectTypeId) => ({
    objectTypeId,
    label: objectTypeDisplayLabel(project, objectTypeId),
  }))

  const entityTypes = entityTypesAll.filter((t) =>
    matchesExplorerQuery(q, t.label, t.objectTypeId, 'type', 'entity types'),
  )

  const imagesAll = Object.values(project.assets ?? {}).map((a) => ({
    id: a.id,
    name: a.name,
    path: a.path,
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
    entities,
    entityTypes,
    assetFolders,
    hasSearch,
    scenesVisible: scenes.length > 0 || !hasSearch,
    entitiesVisible: entities.length > 0 || !hasSearch,
    entityTypesVisible: entityTypes.length > 0 || !hasSearch,
    assetsVisible: assetFolders.length > 0 || !hasSearch,
  }
}

export function assetFolderItemCount(folder: ExplorerAssetFolder): number {
  return folder.images.length + folder.audio.length + folder.fonts.length
    + folder.scripts.length + folder.tilesets.length
}
