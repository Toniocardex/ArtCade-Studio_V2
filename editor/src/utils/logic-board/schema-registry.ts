// ---------------------------------------------------------------------------
// Logic Board JSON Schema registry — validation (Ajv) + UI metadata (x-artcade)
// ---------------------------------------------------------------------------

import type { ErrorObject } from 'ajv'
import indexJson from '../../schemas/logic-board/index.json'
import triggersJson from '../../schemas/logic-board/triggers.json'
import actionsJson from '../../schemas/logic-board/actions.json'
import conditionsJson from '../../schemas/logic-board/conditions.json'
import {
  componentValidators as componentValidatorsRaw,
  validateBoard as validateBoardCompiled,
} from './validators.generated'
import type {
  LogicAction,
  LogicBoard,
  LogicBoardDoc,
  LogicCondition,
  LogicConditionNode,
  LogicTrigger,
} from '../../types/logic-board'

/** Pre-compiled Ajv validator (build-time standalone code). */
type LogicValidator = {
  (data: unknown): boolean
  errors?: ErrorObject[] | null
}

const componentValidators = componentValidatorsRaw as Record<string, LogicValidator>
const boardValidator = validateBoardCompiled as LogicValidator

export type ComponentKind = 'trigger' | 'action' | 'condition'

export type ParamWidget =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'target'
  | 'color'
  | 'keyCapture'
  | 'className'
  | 'entityTag'

export interface ParamFieldMeta {
  widget: ParamWidget
  label: string
  placeholder?: string
  options?: string[]
}

export interface ComponentMeta {
  label: string
  category: string
  params: Record<string, ParamFieldMeta>
}

export interface ValidationIssue {
  path: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
}

type SchemaRecord = Record<string, Record<string, unknown>>

interface ArtCadeExt {
  label?: string
  category?: string
  params?: Record<string, ParamFieldMeta>
}

const triggers = triggersJson as SchemaRecord
const actions = actionsJson as SchemaRecord
const conditions = conditionsJson as SchemaRecord

const index = indexJson as {
  triggers: string[]
  actions: string[]
  conditions: string[]
}

function getArtcade(schema: Record<string, unknown>): ArtCadeExt {
  return (schema['x-artcade'] as ArtCadeExt | undefined) ?? {}
}

function ajvErrorToIssues(errors: ErrorObject[] | null | undefined, prefix: string): ValidationIssue[] {
  if (!errors?.length) return []
  return errors.map((e) => ({
    path: prefix + (e.instancePath || ''),
    message: e.message ?? 'invalid',
  }))
}

function getRawSchema(kind: ComponentKind, type: string): Record<string, unknown> | undefined {
  const table =
    kind === 'trigger' ? triggers : kind === 'action' ? actions : conditions
  return table[type] as Record<string, unknown> | undefined
}

function getValidator(kind: ComponentKind, type: string): LogicValidator | undefined {
  return componentValidators[`${kind}:${type}`]
}

export function listTriggerTypes(): string[] {
  return [...index.triggers]
}

export function listActionTypes(): string[] {
  return [...index.actions]
}

export function listConditionTypes(): string[] {
  return [...index.conditions]
}

export function getComponentMeta(kind: ComponentKind, type: string): ComponentMeta | undefined {
  const raw = getRawSchema(kind, type)
  if (!raw) return undefined
  const ext = getArtcade(raw)
  return {
    label: ext.label ?? type,
    category: ext.category ?? 'Other',
    params: ext.params ?? {},
  }
}

export function usesSchemaParamForm(kind: ComponentKind, type: string): boolean {
  return getRawSchema(kind, type) !== undefined
}

export function validateConditionNode(
  node: unknown,
  pathPrefix = '/conditionRoot',
): ValidationResult {
  const errors: ValidationIssue[] = []
  if (!node || typeof node !== 'object') {
    return { valid: false, errors: [{ path: pathPrefix, message: 'invalid condition node' }] }
  }
  const n = node as Record<string, unknown>
  const kind = n.kind

  if (kind === 'leaf') {
    const cr = validateCondition(n.condition)
    if (!cr.valid) {
      errors.push(
        ...cr.errors.map((x) => ({
          ...x,
          path: `${pathPrefix}/condition${x.path.replace('/condition', '')}`,
        })),
      )
    }
    return { valid: errors.length === 0, errors }
  }

  if (kind === 'group') {
    if (n.operator !== 'AND' && n.operator !== 'OR') {
      errors.push({ path: `${pathPrefix}/operator`, message: 'must be AND or OR' })
    }
    if (!Array.isArray(n.statements)) {
      errors.push({ path: `${pathPrefix}/statements`, message: 'must be array' })
    } else if (n.statements.length === 0) {
      errors.push({ path: `${pathPrefix}/statements`, message: 'must have at least one child' })
    } else {
      n.statements.forEach((child, i) => {
        const sr = validateConditionNode(child, `${pathPrefix}/statements[${i}]`)
        if (!sr.valid) errors.push(...sr.errors)
      })
    }
    return { valid: errors.length === 0, errors }
  }

  return {
    valid: false,
    errors: [{ path: `${pathPrefix}/kind`, message: 'must be "leaf" or "group"' }],
  }
}

/** Default AND group with one compareVariable leaf (tree mode). */
export function defaultConditionRoot(): LogicConditionNode {
  return {
    kind: 'group',
    operator: 'AND',
    statements: [
      {
        kind: 'leaf',
        condition: { type: 'compareVariable', key: 'score', operator: '>=', value: 0 },
      },
    ],
  }
}

export function validateTrigger(trigger: unknown): ValidationResult {
  if (!trigger || typeof trigger !== 'object') {
    return { valid: false, errors: [{ path: '/trigger', message: 'missing trigger' }] }
  }
  const type = (trigger as { type?: string }).type
  if (!type) {
    return { valid: false, errors: [{ path: '/trigger/type', message: 'missing type' }] }
  }
  const fn = getValidator('trigger', type)
  if (!fn) {
    return { valid: false, errors: [{ path: '/trigger/type', message: `unknown trigger: ${type}` }] }
  }
  const ok = fn(trigger)
  return { valid: !!ok, errors: ajvErrorToIssues(fn.errors, '/trigger') }
}

export function validateAction(action: unknown): ValidationResult {
  if (!action || typeof action !== 'object') {
    return { valid: false, errors: [{ path: '/action', message: 'missing action' }] }
  }
  const type = (action as { type?: string }).type
  if (!type) {
    return { valid: false, errors: [{ path: '/action/type', message: 'missing type' }] }
  }
  const fn = getValidator('action', type)
  if (!fn) {
    return { valid: false, errors: [{ path: '/action/type', message: `unknown action: ${type}` }] }
  }
  const ok = fn(action)
  return { valid: !!ok, errors: ajvErrorToIssues(fn.errors, '/action') }
}

export function validateCondition(condition: unknown): ValidationResult {
  if (!condition || typeof condition !== 'object') {
    return { valid: false, errors: [{ path: '/condition', message: 'missing condition' }] }
  }
  const type = (condition as { type?: string }).type
  if (!type) {
    return { valid: false, errors: [{ path: '/condition/type', message: 'missing type' }] }
  }
  const fn = getValidator('condition', type)
  if (!fn) {
    return { valid: false, errors: [{ path: '/condition/type', message: `unknown condition: ${type}` }] }
  }
  const ok = fn(condition)
  return { valid: !!ok, errors: ajvErrorToIssues(fn.errors, '/condition') }
}

export function validateLogicEvent(
  event: unknown,
  pathPrefix = '/events[]',
): ValidationResult {
  const errors: ValidationIssue[] = []
  if (!event || typeof event !== 'object') {
    return { valid: false, errors: [{ path: pathPrefix, message: 'invalid event' }] }
  }
  const e = event as Record<string, unknown>
  if (typeof e.id !== 'string' || !e.id) {
    errors.push({ path: `${pathPrefix}/id`, message: 'id required' })
  }
  if (typeof e.enabled !== 'boolean') {
    errors.push({ path: `${pathPrefix}/enabled`, message: 'enabled must be boolean' })
  }

  const tr = validateTrigger(e.trigger)
  if (!tr.valid) errors.push(...tr.errors.map((x) => ({ ...x, path: pathPrefix + x.path })))

  const hasRoot =
    e.conditionRoot != null && typeof e.conditionRoot === 'object'
  const flatList = Array.isArray(e.conditions) ? e.conditions : []

  if (hasRoot) {
    const nr = validateConditionNode(e.conditionRoot, `${pathPrefix}/conditionRoot`)
    if (!nr.valid) errors.push(...nr.errors)
  } else {
    flatList.forEach((c, i) => {
      const cr = validateCondition(c)
      if (!cr.valid) {
        errors.push(
          ...cr.errors.map((x) => ({
            ...x,
            path: `${pathPrefix}/conditions[${i}]${x.path.replace('/condition', '')}`,
          })),
        )
      }
    })
  }

  if (!Array.isArray(e.actions)) {
    errors.push({ path: `${pathPrefix}/actions`, message: 'actions must be array' })
  } else {
    e.actions.forEach((a, i) => {
      const ar = validateAction(a)
      if (!ar.valid) {
        errors.push(
          ...ar.errors.map((x) => ({
            ...x,
            path: `${pathPrefix}/actions[${i}]${x.path.replace('/action', '')}`,
          })),
        )
      }
    })
  }

  return { valid: errors.length === 0, errors }
}

export function validateLogicBoard(board: unknown): ValidationResult {
  const errors: ValidationIssue[] = []
  const ok = boardValidator(board)
  if (!ok) {
    errors.push(...ajvErrorToIssues(boardValidator.errors, ''))
  }
  if (!board || typeof board !== 'object') {
    return { valid: false, errors }
  }
  const b = board as LogicBoard
  b.events?.forEach((ev, i) => {
    const er = validateLogicEvent(ev, `/events[${i}]`)
    if (!er.valid) errors.push(...er.errors)
  })
  return { valid: errors.length === 0, errors }
}

export function validateLogicBoardDoc(doc: LogicBoardDoc | undefined): ValidationResult {
  if (!doc?.length) return { valid: true, errors: [] }
  const errors: ValidationIssue[] = []
  doc.forEach((board, i) => {
    const r = validateLogicBoard(board)
    if (!r.valid) {
      errors.push(
        ...r.errors.map((e) => ({
          ...e,
          path: `/logicBoards[${i}]${e.path}`,
        })),
      )
    }
  })
  return { valid: errors.length === 0, errors }
}

/** Strict validation before persisting project.json */
export function assertLogicBoardsValid(doc: LogicBoardDoc | undefined): void {
  const r = validateLogicBoardDoc(doc)
  if (r.valid) return
  const msg = r.errors
    .slice(0, 8)
    .map((e) => `${e.path}: ${e.message}`)
    .join('\n')
  throw new Error(
    `Logic Board validation failed (${r.errors.length} issue(s)):\n${msg}${
      r.errors.length > 8 ? '\n…' : ''
    }`,
  )
}

export function formatValidationErrors(result: ValidationResult): string {
  return result.errors.map((e) => `${e.path}: ${e.message}`).join('\n')
}

// Type guards for schema-driven UI
export function asTrigger(v: Record<string, unknown>): LogicTrigger {
  return v as LogicTrigger
}

export function asAction(v: Record<string, unknown>): LogicAction {
  return v as LogicAction
}

export function asCondition(v: Record<string, unknown>): LogicCondition {
  return v as LogicCondition
}
