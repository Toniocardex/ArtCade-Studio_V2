/** Audit RULE.<slug> references vs the generated `local RULE = { ... }` table. */
export function ruleBindingsAreConsistent(lua: string): {
  referenced: Set<string>
  bound: Set<string>
  missing: string[]
} {
  const referenced = new Set<string>()
  const refRe = /RULE\.([A-Za-z_]\w*)/g
  let refMatch: RegExpExecArray | null
  while ((refMatch = refRe.exec(lua)) !== null) {
    referenced.add(refMatch[1])
  }

  const bound = new Set<string>()
  const tableRe = /local RULE = \{([\s\S]*?)\n\}/
  const tableMatch = tableRe.exec(lua)
  if (tableMatch) {
    const keyRe = /^\s*([A-Za-z_]\w*)\s*=/gm
    let keyMatch: RegExpExecArray | null
    while ((keyMatch = keyRe.exec(tableMatch[1])) !== null) {
      bound.add(keyMatch[1])
    }
  }

  const missing = [...referenced].filter((s) => !bound.has(s))
  return { referenced, bound, missing }
}
