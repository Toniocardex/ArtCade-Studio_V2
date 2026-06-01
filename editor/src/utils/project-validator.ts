// ---------------------------------------------------------------------------
// Project Model validation (report §21) — errors before save / play.
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'

export type ProjectDiagnosticSeverity = 'error' | 'warn'

export interface ProjectDiagnostic {
  message: string
  severity: ProjectDiagnosticSeverity
  /** Entity id, scene id, asset id, or board id when applicable. */
  context?: string
}

function objectTypeSpriteAssetId(project: ProjectDoc, typeId: string): string | undefined {
  const ot = project.objectTypes?.[typeId]
  if (!ot?.sprite?.spriteAssetId) return undefined
  return ot.sprite.spriteAssetId
}

export function collectProjectDiagnostics(project: ProjectDoc): ProjectDiagnostic[] {
  const out: ProjectDiagnostic[] = []
  const assets = project.assets ?? {}
  const audio = project.audioAssets ?? {}
  const types = project.objectTypes ?? {}

  for (const [id, ent] of Object.entries(project.entities ?? {})) {
    const numId = Number(id)
    const sid = ent.sprite?.spriteAssetId?.trim()
    if (sid && !assets[sid]) {
      out.push({
        severity: 'error',
        context: `entity:${numId}`,
        message: `Entity "${ent.name}" (#${numId}) references missing image asset "${sid}".`,
      })
    }
    const body = ent.physics?.bodyType
    if (body === 'Dynamic' || body === 'Kinematic') {
      if (!ent.physics?.collider) {
        out.push({
          severity: 'warn',
          context: `entity:${numId}`,
          message: `Entity "${ent.name}" has ${body} physics but no collider defined.`,
        })
      }
    }
  }

  for (const [typeId, ot] of Object.entries(types)) {
    const sid = ot.sprite?.spriteAssetId?.trim()
    if (sid && !assets[sid]) {
      out.push({
        severity: 'error',
        context: `objectType:${typeId}`,
        message: `Object type "${ot.displayName}" references missing image asset "${sid}".`,
      })
    }
  }

  for (const scene of Object.values(project.scenes ?? {})) {
    for (const eid of scene.entityIds ?? []) {
      if (!project.entities[eid]) {
        out.push({
          severity: 'error',
          context: `scene:${scene.id}`,
          message: `Scene "${scene.name}" lists missing entity id ${eid}.`,
        })
      }
    }
    for (const inst of scene.instances ?? []) {
      if (!types[inst.objectTypeId]) {
        out.push({
          severity: 'error',
          context: `scene:${scene.id}`,
          message: `Scene "${scene.name}": instance #${inst.id} references unknown object type "${inst.objectTypeId}".`,
        })
      } else {
        const sid = objectTypeSpriteAssetId(project, inst.objectTypeId)
        if (sid && !assets[sid]) {
          out.push({
            severity: 'error',
            context: `scene:${scene.id}`,
            message: `Scene "${scene.name}": instance #${inst.id} uses type with missing asset "${sid}".`,
          })
        }
      }
    }
  }

  return out
}

export function projectDiagnosticsErrors(diagnostics: ProjectDiagnostic[]): ProjectDiagnostic[] {
  return diagnostics.filter((d) => d.severity === 'error')
}

export function formatProjectDiagnostics(diagnostics: ProjectDiagnostic[]): string | null {
  if (diagnostics.length === 0) return null
  return diagnostics.map((d) => d.message).join('\n')
}

export function assertProjectDiagnosticsClean(project: ProjectDoc): void {
  const errors = projectDiagnosticsErrors(collectProjectDiagnostics(project))
  if (errors.length === 0) return
  throw new Error(errors.map((e) => e.message).join('\n'))
}
