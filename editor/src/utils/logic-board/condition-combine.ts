// ---------------------------------------------------------------------------
// AND / OR / NOT — flat Also require… and condition tree groups
// ---------------------------------------------------------------------------

export type ConditionCombineOp = 'AND' | 'OR' | 'NOT'

export const CONDITION_COMBINE_OPTIONS: ReadonlyArray<{
  value: ConditionCombineOp
  label: string
}> = [
  { value: 'AND', label: 'AND' },
  { value: 'OR', label: 'OR' },
  { value: 'NOT', label: 'NOT' },
]

export const CONDITION_POLARITY_OPTIONS = [
  { value: 'pass', label: 'Pass' },
  { value: 'not', label: 'NOT' },
] as const

/** Wrap a leaf expression when the row is inverted (Pass / NOT). */
export function wrapNegated(expr: string, negated?: boolean): string {
  return negated ? `not (${expr})` : expr
}

/** Join sub-expressions for flat list or tree group operator. */
export function combineConditionExprs(
  parts: string[],
  op: ConditionCombineOp,
): string {
  if (parts.length === 0) return 'true'
  if (parts.length === 1) {
    return op === 'NOT' ? `not (${parts[0]})` : parts[0]
  }
  if (op === 'NOT') return `not (${parts.join(' or ')})`
  const joiner = op === 'OR' ? ' or ' : ' and '
  return `(${parts.join(joiner)})`
}

/** Remove editor-only `negated` before JSON-schema validation. */
export function stripConditionNegation(c: unknown): Record<string, unknown> {
  if (!c || typeof c !== 'object') return {}
  const { negated: _n, ...rest } = c as { negated?: boolean }
  return rest
}
