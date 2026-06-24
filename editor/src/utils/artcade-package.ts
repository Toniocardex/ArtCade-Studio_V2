import { isTauri } from '@tauri-apps/api/core'
import { readFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs'
import type { ProjectDoc } from '../types'
import type { LogicBoardLoadIssue } from '../types/logic-board'
import {
  dirName,
  parseProjectDocWithMeta,
  safeProjectFolderName,
  unsupportedProjectFormatMessage,
} from './project'
import { baseName, joinPath } from './file-paths'
import { assertProjectPathsSafe } from './project-path-security'
import { decodeZipEntryUtf8, inflateZipEntry, parseZipEntries } from './artcade-zip-io'
import { invokeTauri } from './tauri-invoke'

export interface LoadedProjectFile {
  project: ProjectDoc
  path: string
  migratedFromLegacy?: boolean
  logicBoardLoadIssues?: LogicBoardLoadIssue[]
  openWarnings?: string[]
}

export function isArtcadePackagePath(path: string): boolean {
  return path.toLowerCase().endsWith('.artcade')
}

/** Magic prefix of the encrypted .artcade container (see tools/artcade_crypto.py). */
const ARTCADE_ENCRYPTED_MAGIC = 'ARTCADE1'

/** True when bytes are an encrypted .artcade container rather than a plain ZIP. */
export function isEncryptedArtcadeContainer(bytes: Uint8Array): boolean {
  if (bytes.length < ARTCADE_ENCRYPTED_MAGIC.length) return false
  for (let i = 0; i < ARTCADE_ENCRYPTED_MAGIC.length; i++) {
    if (bytes[i] !== ARTCADE_ENCRYPTED_MAGIC.charCodeAt(i)) return false
  }
  return true
}

/**
 * Unwrap an encrypted .artcade container into its inner plaintext ZIP via the
 * Rust backend (which holds the shared key). Plain ZIPs pass through unchanged.
 */
async function toPlainZipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (!isEncryptedArtcadeContainer(bytes)) return bytes
  const plain = await invokeTauri<number[]>('decrypt_artcade_container', {
    bytes: Array.from(bytes),
  })
  return new Uint8Array(plain)
}

/** True when package JSON had no objectTypes but normalize added them from legacy entities. */
export function detectLegacyMigrationFromPackageJson(
  projectJson: string,
  project: ProjectDoc,
): boolean {
  let raw: { objectTypes?: unknown; object_types?: unknown }
  try {
    raw = JSON.parse(projectJson) as { objectTypes?: unknown; object_types?: unknown }
  } catch {
    return false
  }
  return (
    !raw.objectTypes
    && !raw.object_types
    && Boolean(project.objectTypes && Object.keys(project.objectTypes).length > 0)
  )
}

export async function importArtcadePackage(packagePath: string): Promise<LoadedProjectFile | null> {
  if (!isTauri()) {
    console.warn('[api] importArtcadePackage: Tauri not available in browser mode')
    return null
  }

  try {
    const raw = await readFile(packagePath)
    // Editor-produced packages are encrypted; unwrap them (plain ZIPs pass
    // through) so opening a .artcade you packed round-trips back into the editor.
    const bytes = await toPlainZipBytes(raw)
    const entries = parseZipEntries(bytes)
    const projectEntry = entries.find((entry) => entry.path === 'project.json')
    if (!projectEntry) {
      throw new Error('project.json not found inside package')
    }

    const projectJson = await decodeZipEntryUtf8(bytes, projectEntry)
    const unsupportedFormat = unsupportedProjectFormatMessage(projectJson)
    if (unsupportedFormat) throw new Error(unsupportedFormat)
    const parsed = parseProjectDocWithMeta(projectJson)
    if (!parsed) {
      throw new Error('project.json inside package is invalid')
    }
    const { project, logicBoardLoadIssues } = parsed
    assertProjectPathsSafe(project)
    const migratedFromLegacy = detectLegacyMigrationFromPackageJson(projectJson, project)

    const importRoot = await uniqueImportRoot(packagePath, project.projectName)
    for (const entry of entries) {
      const relPath = safeArchivePath(entry.path)
      if (!relPath) continue
      const outputPath = joinPath(importRoot, relPath)
      await mkdir(dirName(outputPath), { recursive: true })
      await writeFile(outputPath, await inflateZipEntry(bytes, entry))
    }

    return {
      project,
      path: joinPath(importRoot, 'project.json'),
      ...(migratedFromLegacy ? { migratedFromLegacy: true } : {}),
      ...(logicBoardLoadIssues.length > 0 ? { logicBoardLoadIssues } : {}),
    }
  } catch (err) {
    console.error('[api] importArtcadePackage failed:', err)
    return null
  }
}

function safeArchivePath(path: string): string | null {
  return path.endsWith('/') ? null : path
}

async function uniqueImportRoot(packagePath: string, projectName: string): Promise<string> {
  const baseDir = dirName(packagePath)
  const packageName = baseName(packagePath).replace(/\.artcade$/i, '')
  const safeName = safeProjectFolderName(projectName || packageName, packageName || 'Imported')
  const base = joinPath(baseDir, `${safeName}_imported`)
  if (!(await exists(base))) return base

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`
    if (!(await exists(candidate))) return candidate
  }
  throw new Error(`could not find an available import folder for ${packagePath}`)
}
