// ---------------------------------------------------------------------------
// Unified project health + preview Lua (single compile per project revision).
// ---------------------------------------------------------------------------

import type { ProjectDoc, ScriptFile } from '../types'
import { composeProjectLua } from './project-lua-composer'
import { resolveManualMainLua } from './project-main-script'
import { BLANK_MAIN_LUA } from './project-factory'
import { projectRevision } from '../store/project-history'
import { getPreviewLuaSyncKey } from './preview-lua-sync'
import {
  collectProjectDiagnostics,
  projectDiagnosticsWarnings,
  type ProjectDiagnostic,
} from './project-validator'
import { collectSaveValidationErrors } from './project-persist'
import {
  collectConfigDiagnostics,
  compileProjectLogic,
  type CompileProjectLogicResult,
  type LogicDiagnostic,
} from './logic-board/logic-compile-service'

export type HealthSeverity = 'error' | 'warn'

export interface HealthIssue {
  severity: HealthSeverity
  message: string
  context?: string
  source: 'project' | 'logic-config' | 'logic-compile'
}

export interface ProjectHealth {
  errors: HealthIssue[]
  warnings: HealthIssue[]
  blocksPlay: boolean
}

export interface ProjectWorkbenchSnapshot {
  cacheKey: string
  health: ProjectHealth
  previewLua: { lua: string; compileError: string | null }
}

export interface ProjectWorkbenchInput {
  project: ProjectDoc | null
  projectPath?: string | null
  openScripts?: ScriptFile[]
  includeCompile: boolean
}

const workbenchCache = new Map<string, ProjectWorkbenchSnapshot>()

export function clearProjectWorkbenchCache(): void {
  workbenchCache.clear()
}

function mapProject(d: ProjectDiagnostic): HealthIssue {
  return {
    severity: d.severity,
    message: d.message,
    context: d.context,
    source: 'project',
  }
}

function mapLogic(d: LogicDiagnostic): HealthIssue {
  return {
    severity: d.severity,
    message: d.message,
    context: d.boardId ? `board:${d.boardId}` : undefined,
    source: d.source === 'compile' ? 'logic-compile' : 'logic-config',
  }
}

function buildHealthFromDiagnostics(
  project: ProjectDoc,
  compileResult: CompileProjectLogicResult | null,
): ProjectHealth {
  const projectDiags = collectProjectDiagnostics(project)
  const warnings: HealthIssue[] = projectDiagnosticsWarnings(projectDiags).map(mapProject)

  const errors: HealthIssue[] = collectSaveValidationErrors(project).map((message) => ({
    severity: 'error' as const,
    message,
    source: 'project' as const,
  }))

  for (const d of collectConfigDiagnostics(project)) {
    const issue = mapLogic(d)
    if (issue.severity === 'error') errors.push(issue)
    else warnings.push(issue)
  }

  if (compileResult) {
    for (const d of compileResult.diagnostics) {
      if (d.source !== 'compile') continue
      const issue = mapLogic(d)
      if (issue.severity === 'error') errors.push(issue)
    }
    if (
      compileResult.compileError &&
      !errors.some((e) => e.message === compileResult.compileError)
    ) {
      errors.push({
        severity: 'error',
        message: compileResult.compileError,
        source: 'logic-compile',
      })
    }
  }

  return {
    errors,
    warnings,
    blocksPlay: errors.length > 0,
  }
}

function resolvePreviewLua(
  project: ProjectDoc,
  openScripts: ScriptFile[],
  projectPath: string | null | undefined,
  compileResult: CompileProjectLogicResult | null,
): { lua: string; compileError: string | null } {
  const boards = project.logicBoards ?? []
  const manualLua = resolveManualMainLua(project, openScripts)

  if (boards.length > 0) {
    if (compileResult) {
      return {
        lua: composeProjectLua({
          manualLua,
          generatedLua: compileResult.lua,
          projectKey: projectPath,
        }).combinedLua,
        compileError: compileResult.compileError,
      }
    }
    const result = compileProjectLogic(project, { projectKey: projectPath ?? undefined })
    return {
      lua: composeProjectLua({
        manualLua,
        generatedLua: result.lua,
        projectKey: projectPath,
      }).combinedLua,
      compileError: result.compileError,
    }
  }

  return {
    lua: composeProjectLua({
      manualLua: manualLua || BLANK_MAIN_LUA,
      projectKey: projectPath,
    }).combinedLua,
    compileError: null,
  }
}

function workbenchCacheKey(input: ProjectWorkbenchInput): string {
  const { project, projectPath, openScripts = [], includeCompile } = input
  if (!project) return 'null'
  return JSON.stringify({
    rev: projectRevision(project),
    path: projectPath ?? '',
    compile: includeCompile,
    luaKey: getPreviewLuaSyncKey({ project, openScripts, projectPath }),
  })
}

function buildWorkbenchSnapshot(input: ProjectWorkbenchInput): ProjectWorkbenchSnapshot {
  const { project, projectPath, openScripts = [], includeCompile } = input
  const cacheKey = workbenchCacheKey(input)

  if (!project) {
    return {
      cacheKey,
      health: { errors: [], warnings: [], blocksPlay: true },
      previewLua: { lua: BLANK_MAIN_LUA, compileError: null },
    }
  }

  const boards = project.logicBoards ?? []
  const needsCompile = includeCompile && boards.length > 0

  const compileResult = needsCompile
    ? compileProjectLogic(project, { projectKey: projectPath ?? undefined })
    : null

  const health = buildHealthFromDiagnostics(project, compileResult)
  const previewLua = resolvePreviewLua(project, openScripts, projectPath, compileResult)

  return { cacheKey, health, previewLua }
}

/** Cached health + preview Lua for banner, Play gate, status bar, and sync. */
export function getProjectWorkbenchSnapshot(
  input: ProjectWorkbenchInput,
): ProjectWorkbenchSnapshot {
  const cacheKey = workbenchCacheKey(input)
  const cached = workbenchCache.get(cacheKey)
  if (cached) return cached

  const snapshot = buildWorkbenchSnapshot(input)
  workbenchCache.set(cacheKey, snapshot)
  return snapshot
}

/** Structural + config diagnostics only (no Logic Board compile). */
export function collectProjectHealth(
  project: ProjectDoc | null,
  options?: { projectKey?: string },
): ProjectHealth {
  return getProjectWorkbenchSnapshot({
    project,
    projectPath: options?.projectKey,
    openScripts: [],
    includeCompile: false,
  }).health
}

export function formatHealthSummary(health: ProjectHealth): string | null {
  const lines = [
    ...health.errors.map((e) => `Error: ${e.message}`),
    ...health.warnings.map((w) => `Warning: ${w.message}`),
  ]
  return lines.length > 0 ? lines.join('\n') : null
}

export function playBlockReason(
  project: ProjectDoc | null,
  projectPath?: string | null,
  openScripts: ScriptFile[] = [],
): string | null {
  const health = getProjectWorkbenchSnapshot({
    project,
    projectPath,
    openScripts,
    includeCompile: true,
  }).health
  if (!health.blocksPlay) return null
  return health.errors[0]?.message ?? 'Project has validation errors.'
}
