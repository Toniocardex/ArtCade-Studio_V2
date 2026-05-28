#!/usr/bin/env node
/**
 * CLI: import ArtCade dialog CSV → dialogs/{id}.json
 * Usage: node scripts/import-dialog-csv.mjs path.csv --out ../dialogs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const editorRoot = join(__dirname, '..')

const args = process.argv.slice(2)
const csvPath = args.find((a) => !a.startsWith('--'))
const outIdx = args.indexOf('--out')
const outDir = outIdx >= 0 ? resolve(args[outIdx + 1]) : resolve(editorRoot, '..', 'dialogs')

if (!csvPath) {
  console.error('Usage: node scripts/import-dialog-csv.mjs <file.csv> [--out dialogs/]')
  process.exit(1)
}

const modUrl = pathToFileURL(join(editorRoot, 'src/utils/dialog/import-dialog-csv.ts')).href
const { importDialogCsv, dialogGraphToJson } = await import(modUrl)

const csvText = readFileSync(resolve(csvPath), 'utf8')
const { graphs, errors } = importDialogCsv(csvText)
for (const e of errors) console.warn('[warn]', e)
mkdirSync(outDir, { recursive: true })
for (const g of graphs) {
  const outPath = join(outDir, `${g.dialogId}.json`)
  writeFileSync(outPath, dialogGraphToJson(g), 'utf8')
  console.log('Wrote', outPath)
}
