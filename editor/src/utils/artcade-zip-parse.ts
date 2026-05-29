// ---------------------------------------------------------------------------
// artcade-zip-parse — read .artcade ZIP bytes (shared by import + tests)
// ---------------------------------------------------------------------------

import { parseProjectDoc } from './project-codec'
import type { ProjectDoc } from '../types'
import type { ProjectAssetManifest } from './build-project-asset-manifest'
import { decodeZipEntryUtf8, parseZipEntries } from './artcade-zip-io'

export type ParsedArtcadePackage = Readonly<{
  project: ProjectDoc
  manifest: ProjectAssetManifest | null
}>

/** Parse in-memory .artcade ZIP bytes (no filesystem). */
export async function parseArtcadePackageBytes(bytes: Uint8Array): Promise<ParsedArtcadePackage> {
  const entries = parseZipEntries(bytes)
  const projectEntry = entries.find((e) => e.path === 'project.json')
  if (!projectEntry) throw new Error('project.json not found inside package')

  const projectJson = await decodeZipEntryUtf8(bytes, projectEntry)
  const project = parseProjectDoc(projectJson)
  if (!project) throw new Error('invalid project.json inside package')

  const manifestEntry = entries.find((e) => e.path === 'manifest.json')
  let manifest: ProjectAssetManifest | null = null
  if (manifestEntry) {
    const manifestJson = await decodeZipEntryUtf8(bytes, manifestEntry)
    manifest = JSON.parse(manifestJson) as ProjectAssetManifest
  }

  return { project, manifest }
}
