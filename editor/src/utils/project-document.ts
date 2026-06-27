/**
 * Project document envelope: format version, engine version, and load pipeline.
 *
 * Load order (no disk writes):
 *   read bytes → parse JSON → inspect format version → parse schema → ProjectDoc
 *
 * `projectFormatVersion` is the persisted schema revision.
 * `engineVersion` is the ArtCade Studio build that last saved the file.
 * They are intentionally independent.
 */

import type { ProjectDoc } from '../types'
import {
  parseProjectDocWithMeta,
  type ParseProjectDocResult,
  unsupportedProjectFormatMessage,
} from './project-codec'
import {
  CURRENT_PROJECT_FORMAT_VERSION,
  EDITOR_ENGINE_VERSION,
} from './project-format'
import {
  migrateProjectJsonRoot,
} from './project-migrations'

export { CURRENT_PROJECT_FORMAT_VERSION, EDITOR_ENGINE_VERSION } from './project-format'

export type ProjectLoadErrorCode =
  | 'unreadable'
  | 'newer_than_editor'
  | 'schema_invalid'

export class ProjectLoadError extends Error {
  readonly code: ProjectLoadErrorCode

  constructor(code: ProjectLoadErrorCode, message: string) {
    super(message)
    this.name = 'ProjectLoadError'
    this.code = code
  }
}

export function parseProjectJsonRoot(jsonStr: string): Record<string, unknown> {
  let raw: unknown
  try {
    raw = JSON.parse(jsonStr)
  } catch {
    throw new ProjectLoadError(
      'unreadable',
      'The project file is not valid JSON.',
    )
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ProjectLoadError(
      'unreadable',
      'The project file must contain a single JSON object.',
    )
  }
  return raw as Record<string, unknown>
}

/**
 * Reads the persisted schema revision from a parsed project root object.
 * Accepts legacy `formatVersion` when `projectFormatVersion` is absent.
 */
export function resolveProjectFormatVersion(raw: Record<string, unknown>): number {
  const explicit = raw.projectFormatVersion ?? raw.project_format_version
  const legacy = raw.formatVersion ?? raw.format_version
  const candidate = explicit ?? legacy ?? 0
  const version = Number(candidate)
  return Number.isFinite(version) ? version : 0
}

export function assertProjectFormatReadable(
  jsonStr: string,
  maxSupported: number = CURRENT_PROJECT_FORMAT_VERSION,
): void {
  const raw = parseProjectJsonRoot(jsonStr)
  const version = resolveProjectFormatVersion(raw)

  const newerThanEditor = unsupportedProjectFormatMessage(jsonStr)
  if (newerThanEditor) {
    throw new ProjectLoadError('newer_than_editor', newerThanEditor)
  }

  if (version > maxSupported) {
    throw new ProjectLoadError(
      'newer_than_editor',
      `Project format v${version} is newer than this editor supports (current: v${maxSupported}).`,
    )
  }
}

function ensureProjectId(project: ProjectDoc, raw: Record<string, unknown>): ProjectDoc {
  const fromDisk = raw.projectId ?? raw.project_id
  if (typeof fromDisk === 'string' && fromDisk.trim().length > 0) {
    return { ...project, projectId: fromDisk.trim() }
  }
  if (project.projectId?.trim()) return project
  return { ...project, projectId: crypto.randomUUID() }
}

function ensureDocumentMetadata(project: ProjectDoc, raw: Record<string, unknown>): ProjectDoc {
  const rawVersion = resolveProjectFormatVersion(raw)
  const migratedVersion = project.projectFormatVersion ?? project.formatVersion ?? 0
  const projectFormatVersion = Math.max(rawVersion, migratedVersion) || undefined
  const engineVersion =
    typeof raw.engineVersion === 'string' && raw.engineVersion.trim()
      ? raw.engineVersion.trim()
      : typeof raw.engine_version === 'string' && raw.engine_version.trim()
        ? String(raw.engine_version).trim()
        : project.engineVersion
  const withId = ensureProjectId(project, raw)
  return {
    ...withId,
    ...(projectFormatVersion ? { projectFormatVersion } : {}),
    ...(engineVersion ? { engineVersion } : {}),
  }
}

/**
 * Parse and validate a project document from JSON text.
 * @throws ProjectLoadError on unreadable JSON, unsupported version, or schema failure
 */
export function loadProjectDocument(jsonStr: string): ParseProjectDocResult {
  const raw = parseProjectJsonRoot(jsonStr)
  assertProjectFormatReadable(jsonStr)

  const migration = migrateProjectJsonRoot(raw)
  const migratedJson = JSON.stringify(migration.raw)

  const parsed = parseProjectDocWithMeta(migratedJson, {
    migrationFromVersion: migration.fromVersion,
  })
  if (!parsed) {
    throw new ProjectLoadError(
      'schema_invalid',
      'The project file is missing required fields or contains invalid data.',
    )
  }

  return {
    ...parsed,
    project: ensureDocumentMetadata(parsed.project, migration.raw),
  }
}

/**
 * Re-parse serialized JSON before committing to disk.
 * @throws ProjectLoadError when the serialized document would not reload cleanly
 */
export function validateSerializedProjectDocument(jsonStr: string): void {
  loadProjectDocument(jsonStr)
}
