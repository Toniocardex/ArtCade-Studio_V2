/**
 * Explicit project format migration chain (JSON root + in-memory ProjectDoc).
 *
 * Versions:
 *   v0 — no formatVersion on disk
 *   v1 — flat entities map (legacy authoring)
 *   v2 — objectTypes + scene instances (authoring model)
 *   v3 — materialized entity cache + synced scene indices
 *   v4 — envelope (projectFormatVersion, projectId) + prototype sprite contract
 */

import type { ProjectDoc } from '../types'
import { CURRENT_PROJECT_FORMAT_VERSION } from './project-format'
import {
  isV2ObjectModel,
  migrateLegacyProject,
  materializeAllEntities,
  PROJECT_FORMAT_V3,
  PROJECT_FORMAT_V4,
} from './project-object-types'
import { migrateProjectToPrototypeSprites } from './prototype-sprite'
import { normalizePrototypeSprites } from './prototype-sprite-resolve'
import { normalizeAssetRefs } from './normalize-asset-refs'
import { resolveProjectFormatVersion } from './project-document'

export type ProjectMigrationStep = {
  from: number
  to: number
}

export type ProjectJsonMigrationResult = {
  raw: Record<string, unknown>
  fromVersion: number
  toVersion: number
  steps: ProjectMigrationStep[]
}

function cloneRoot(raw: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>
}

function stampFormatVersion(
  raw: Record<string, unknown>,
  version: number,
): Record<string, unknown> {
  const next = { ...raw, formatVersion: version }
  if (version >= PROJECT_FORMAT_V4) {
    next.projectFormatVersion = version
  }
  return next
}

/**
 * Stamp implicit v0 roots with formatVersion 1.
 */
export function migrateV0ToV1(raw: Record<string, unknown>): Record<string, unknown> {
  if (resolveProjectFormatVersion(raw) > 0) return raw
  return stampFormatVersion(raw, 1)
}

/** Bump envelope to v2 (object-type authoring model). */
export function migrateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  return stampFormatVersion(raw, 2)
}

/** Bump envelope to v3 (instances + materialized cache). */
export function migrateV2ToV3(raw: Record<string, unknown>): Record<string, unknown> {
  return stampFormatVersion(raw, 3)
}

/**
 * Add v4 envelope fields on the JSON root before parse.
 * @param raw parsed project root (mutated copy returned)
 */
export function migrateV3ToV4(raw: Record<string, unknown>): Record<string, unknown> {
  const next = stampFormatVersion(raw, PROJECT_FORMAT_V4)
  const projectId = next.projectId ?? next.project_id
  if (typeof projectId !== 'string' || !projectId.trim()) {
    next.projectId = crypto.randomUUID()
  }
  return next
}

/**
 * Run JSON-root migrations up to `targetVersion`.
 * v1→v2 and v2→v3 are doc-only; this pass stamps v0 and adds the v4 envelope.
 */
export function migrateProjectJsonRoot(
  raw: Record<string, unknown>,
  targetVersion: number = CURRENT_PROJECT_FORMAT_VERSION,
): ProjectJsonMigrationResult {
  let current = cloneRoot(raw)
  let version = resolveProjectFormatVersion(current)
  const fromVersion = version
  const steps: ProjectMigrationStep[] = []

  while (version < targetVersion) {
    if (version === 0) {
      current = migrateV0ToV1(current)
      steps.push({ from: 0, to: 1 })
      version = 1
      continue
    }
    if (version === 1 || version === 2) {
      break
    }
    if (version === 3) {
      current = migrateV3ToV4(current)
      steps.push({ from: 3, to: 4 })
      version = 4
      continue
    }
    break
  }

  return {
    raw: current,
    fromVersion,
    toVersion: version,
    steps,
  }
}

function syncAllSceneEntityIds(project: ProjectDoc): void {
  for (const scene of Object.values(project.scenes ?? {})) {
    scene.entityIds = (scene.instances ?? []).map((instance) => instance.id)
  }
}

/**
 * Lift flat entities into objectTypes + instances (v1 → v3).
 */
export function migrateDocV1ToV3(project: ProjectDoc): ProjectDoc {
  return migrateLegacyProject(project)
}

/**
 * Materialize entity cache for projects that already use object types (v2 → v3).
 */
export function migrateDocV2ToV3(project: ProjectDoc): ProjectDoc {
  const entities = materializeAllEntities(project)
  syncAllSceneEntityIds(project)
  return {
    ...project,
    formatVersion: PROJECT_FORMAT_V3,
    projectFormatVersion: PROJECT_FORMAT_V3,
    entities,
  }
}

/**
 * Prototype sprites, stable asset ids, and v4 envelope on ProjectDoc (v3 → v4).
 */
export function migrateDocV3ToV4(project: ProjectDoc): ProjectDoc {
  let normalized = project
  const prototypeMigration = migrateProjectToPrototypeSprites(normalized)
  normalized = prototypeMigration.changed ? prototypeMigration.project : normalized
  normalized = normalizePrototypeSprites(normalized).project
  normalized = normalizeAssetRefs(normalized).project
  const entities = materializeAllEntities(normalized)
  syncAllSceneEntityIds(normalized)
  return {
    ...normalized,
    formatVersion: PROJECT_FORMAT_V4,
    projectFormatVersion: PROJECT_FORMAT_V4,
    entities,
  }
}

/**
 * Run in-memory migrations from `fromVersion` up to `targetVersion`.
 */
export function migrateProjectDocToVersion(
  project: ProjectDoc,
  fromVersion: number,
  targetVersion: number = CURRENT_PROJECT_FORMAT_VERSION,
): ProjectDoc {
  let current = project
  let version = fromVersion

  while (version < targetVersion) {
    if (version <= 1 && !isV2ObjectModel(current)) {
      current = migrateDocV1ToV3(current)
      version = PROJECT_FORMAT_V3
      continue
    }
    if (version <= 2) {
      current = migrateDocV2ToV3(current)
      version = PROJECT_FORMAT_V3
      continue
    }
    if (version === PROJECT_FORMAT_V3) {
      current = migrateDocV3ToV4(current)
      version = PROJECT_FORMAT_V4
      continue
    }
    break
  }

  return current
}
