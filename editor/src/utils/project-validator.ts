// ---------------------------------------------------------------------------
// Project Model validation (report §21) — errors before save / play.
// ---------------------------------------------------------------------------

import type { ProjectDoc } from '../types'
import type { LogicBoard } from '../types/logic-board'

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

function collectLogicBoardTargetDiagnostics(
  project: ProjectDoc,
  boards: LogicBoard[],
): ProjectDiagnostic[] {
  const out: ProjectDiagnostic[] = []
  const types = project.objectTypes ?? {}
  const seenBoardIds = new Set<string>()

  for (const board of boards) {
    if (seenBoardIds.has(board.boardId)) {
      out.push({
        severity: 'error',
        context: `board:${board.boardId}`,
        message: `Duplicate Logic Board id "${board.boardId}".`,
      })
    }
    seenBoardIds.add(board.boardId)

    const label = board.name?.trim() || board.boardId
    const t = board.target
    if (t.type === 'object_type') {
      const id = t.objectTypeId?.trim()
      if (!id) {
        out.push({
          severity: 'error',
          context: `board:${board.boardId}`,
          message: `Logic Board "${label}" targets object_type but objectTypeId is empty.`,
        })
      } else if (!types[id]) {
        out.push({
          severity: 'error',
          context: `board:${board.boardId}`,
          message: `Logic Board "${label}" references unknown object type "${id}".`,
        })
      }
    }
    // Legacy targets (entity_id / entity_class) are rejected at parse time
    // (factory.parseBoard) — they never reach the validator. Guard anyway so a
    // board injected programmatically with a stale shape fails loudly.
    const rawType = (t as { type: string }).type
    if (rawType === 'entity_id' || rawType === 'entity_class') {
      out.push({
        severity: 'error',
        context: `board:${board.boardId}`,
        message:
          `Logic Board "${label}" uses unsupported legacy target "${rawType}" — ` +
          `re-target it to an object type.`,
      })
    }
  }

  return out
}

export function collectProjectDiagnostics(project: ProjectDoc): ProjectDiagnostic[] {
  const out: ProjectDiagnostic[] = []
  const assets = project.assets ?? {}
  const types = project.objectTypes ?? {}
  const scenes = project.scenes ?? {}

  if (Object.keys(scenes).length === 0) {
    out.push({
      severity: 'error',
      message: 'Project has no scenes.',
    })
  }

  const activeId = project.activeSceneId?.trim()
  if (!activeId) {
    out.push({
      severity: 'error',
      message: 'activeSceneId is not set.',
    })
  } else if (!scenes[activeId]) {
    out.push({
      severity: 'error',
      context: `scene:${activeId}`,
      message: `activeSceneId "${activeId}" does not match any scene.`,
    })
  }

  if ((project.logicBoards?.length ?? 0) > 0 && !project.mainScriptPath?.trim()) {
    out.push({
      severity: 'warn',
      message: 'Logic boards exist but mainScriptPath is empty (compile output may not load).',
    })
  }

  out.push(...collectLogicBoardTargetDiagnostics(project, project.logicBoards ?? []))

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

export function projectDiagnosticsWarnings(diagnostics: ProjectDiagnostic[]): ProjectDiagnostic[] {
  return diagnostics.filter((d) => d.severity === 'warn')
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
