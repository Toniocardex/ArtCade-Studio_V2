/**
 * Build-time Ajv compilation — no new Function() at runtime (Tauri CSP-safe).
 * Run: npm run compile-schemas
 * Output: src/utils/logic-board/validators.generated.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import standaloneCode from 'ajv/dist/standalone/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const editorRoot = path.resolve(__dirname, '..')
const schemaDir = path.join(editorRoot, 'src/schemas/logic-board')
const outFile = path.join(editorRoot, 'src/utils/logic-board/validators.generated.ts')

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(schemaDir, name), 'utf8'))
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v))
}

function resolveRefs(schema, referenceSchemas) {
  const s = deepClone(schema)
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const v of node) walk(v)
      return
    }
    const o = node
    const referenced = typeof o.$ref === 'string' ? referenceSchemas[o.$ref] : undefined
    if (referenced) {
      Object.keys(o).forEach((k) => delete o[k])
      Object.assign(o, deepClone(referenced))
      walk(o)
      return
    }
    for (const v of Object.values(o)) walk(v)
  }
  walk(s)
  return s
}

/** Board-level validation: discriminated trigger/action/condition unions from catalogues. */
function enrichBoardSchema(board, index, triggers, actions, conditions, references) {
  const s = resolveRefs(deepClone(board), references)
  const eventItem = s.properties?.events?.items
  if (!eventItem?.properties) return s

  const triggerUnion = {
    oneOf: index.triggers.map((type) => resolveRefs(deepClone(triggers[type]), references)),
  }
  const actionTypes = [...index.actions, ...(index.legacyActions ?? [])]
  const conditionTypes = [...index.conditions, ...(index.legacyConditions ?? [])]
  const actionUnion = {
    oneOf: actionTypes.map((type) => resolveRefs(deepClone(actions[type]), references)),
  }
  const conditionUnion = {
    oneOf: conditionTypes.map((type) =>
      resolveRefs(deepClone(conditions[type]), references),
    ),
  }

  eventItem.properties.trigger = triggerUnion
  eventItem.properties.actions = { type: 'array', items: actionUnion }
  eventItem.properties.conditions = { type: 'array', items: conditionUnion }
  eventItem.properties.conditionRoot = conditionUnion
  eventItem.properties.elseActions = { type: 'array', items: actionUnion }
  return s
}

function safeExportName(kind, type) {
  return `validate_${kind}_${type.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

/** Compile one schema to an ESM export (no runtime eval). */
function compileExport(exportName, schema) {
  const ajv = new Ajv({ allErrors: true, strict: false, code: { source: true, esm: true } })
  addFormats(ajv)
  const fn = ajv.compile(schema)
  let code = standaloneCode(ajv, fn)
  const fnMatch = code.match(/function (validate\d+)/)
  if (!fnMatch) throw new Error(`Could not parse standalone output for ${exportName}`)
  const generatedName = fnMatch[1]
  code = code.replaceAll(generatedName, exportName)
  code = code.replace(/export default \w+;\s*/g, '')
  code = code.replace(
    new RegExp(`export const ${exportName} = ${exportName};\\s*`),
    '',
  )
  code = code.replace(/export const validate = \w+;\s*/g, '')
  code = code.replace(/"use strict";\s*/g, '')
  code = code.replace(
    /const func\d+ = require\("ajv\/dist\/runtime\/ucs2length"\)\.default;/g,
    '/* ucs2length */',
  )
  return code.trim()
}

const index = readJson('index.json')
const boardSchema = readJson('board.schema.json')
const triggers = readJson('triggers.json')
const actions = readJson('actions.json')
const conditions = readJson('conditions.json')
const targetSelector = readJson('target-selector.schema.json')
const valueSource = readJson('value-source.schema.json')
const references = {
  './target-selector.schema.json': targetSelector,
  './value-source.schema.json': valueSource,
}

const chunks = []
const exportNames = []
const mapEntries = []

exportNames.push('validateBoard')
chunks.push(
  compileExport(
    'validateBoard',
    enrichBoardSchema(boardSchema, index, triggers, actions, conditions, references),
  ),
)

for (const type of index.triggers) {
  const name = safeExportName('trigger', type)
  exportNames.push(name)
  chunks.push(compileExport(name, resolveRefs(triggers[type], references)))
  mapEntries.push(`  'trigger:${type}': ${name},`)
}

for (const type of [...index.actions, ...(index.legacyActions ?? [])]) {
  const name = safeExportName('action', type)
  exportNames.push(name)
  chunks.push(compileExport(name, resolveRefs(actions[type], references)))
  mapEntries.push(`  'action:${type}': ${name},`)
}

for (const type of [...index.conditions, ...(index.legacyConditions ?? [])]) {
  const name = safeExportName('condition', type)
  exportNames.push(name)
  chunks.push(compileExport(name, resolveRefs(conditions[type], references)))
  mapEntries.push(`  'condition:${type}': ${name},`)
}

const header = `// AUTO-GENERATED by scripts/compile-logic-schemas.mjs — do not edit.
// Regenerate: npm run compile-schemas
// @ts-nocheck

import ucs2length from 'ajv/dist/runtime/ucs2length.js'

`

const footer = `
export { validateBoard }

export const componentValidators = {
${mapEntries.join('\n')}
}
`

let parts = chunks.map((chunk, i) => {
  const schemaVar = `schema_${exportNames[i]}`
  let part = chunk.replace(/\bfunc2\b/g, 'ucs2length')
  part = part.replace(/const schema11 =/, `const ${schemaVar} =`)
  part = part.replaceAll('schema11', schemaVar)
  return part
})
const body = parts.join('\n\n')
fs.writeFileSync(outFile, header + body + footer, 'utf8')
console.log(
  `[compile-schemas] Wrote ${chunks.length} validators → ${path.relative(editorRoot, outFile)}`,
)
