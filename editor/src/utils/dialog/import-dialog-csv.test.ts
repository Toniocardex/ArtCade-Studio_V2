import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dialogGraphToJson, importDialogCsv } from './import-dialog-csv'

const repoRoot = join(import.meta.dirname, '../../../..')
const goldenJsonPath = join(repoRoot, 'docs/examples/dialogs/innkeeper.json')
const goldenCsvPath = join(repoRoot, 'docs/examples/dialogs/innkeeper.csv')

describe('importDialogCsv', () => {
  it('imports innkeeper.csv to match golden JSON structure', () => {
    const csv = readFileSync(goldenCsvPath, 'utf8')
    const golden = JSON.parse(readFileSync(goldenJsonPath, 'utf8')) as {
      dialogId: string
      startNode: string
      nodes: Record<string, unknown>
    }

    const { graphs, errors } = importDialogCsv(csv)
    expect(errors).toEqual([])
    expect(graphs).toHaveLength(1)
    const g = graphs[0]
    expect(g.dialogId).toBe('innkeeper')
    expect(g.startNode).toBe('n1')
    expect(g.nodes.n1).toMatchObject({ type: 'say', character: 'Innkeeper', next: 'n2' })
    expect((g.nodes.n3 as { options: unknown[] }).options).toHaveLength(2)
    expect(g.nodes.n_end).toMatchObject({ type: 'end' })

    const roundTrip = JSON.parse(dialogGraphToJson(g))
    expect(roundTrip.dialogId).toBe(golden.dialogId)
    expect(roundTrip.startNode).toBe(golden.startNode)
  })
})
