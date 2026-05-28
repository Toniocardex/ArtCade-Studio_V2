import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  compileDialogScript,
  dialogGraphsStructurallyEqual,
  parseDialogGraph,
  type DialogScript,
} from './dialog-script'
import type { DialogGraphJson } from './import-dialog-csv'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const goldenPath = join(repoRoot, 'docs/examples/dialogs/innkeeper.json')

const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as DialogGraphJson

const innkeeperScript: DialogScript = {
  dialogId: 'innkeeper',
  commands: [
    { type: 'showText', character: 'Innkeeper', text: 'Welcome, traveler!' },
    { type: 'showText', character: 'Innkeeper', text: 'What do you need?' },
    {
      type: 'showChoices',
      options: [
        {
          text: 'A room',
          commands: [
            {
              type: 'setVariable',
              variable: 'quest.met_innkeeper',
              operation: '=',
              value: 1,
            },
            { type: 'emitMessage', event: 'QuestAccepted' },
            { type: 'end' },
          ],
        },
        {
          text: 'No thanks',
          commands: [
            {
              type: 'showText',
              character: 'Innkeeper',
              text: 'Come back anytime.',
            },
            { type: 'end' },
          ],
        },
      ],
    },
  ],
}

describe('compileDialogScript', () => {
  it('matches innkeeper golden graph', () => {
    const compiled = compileDialogScript(innkeeperScript)
    expect(dialogGraphsStructurallyEqual(compiled, golden)).toBe(true)
  })
})

describe('parseDialogGraph', () => {
  it('round-trips innkeeper golden', () => {
    const { script, parseWarning } = parseDialogGraph(golden)
    expect(parseWarning).toBeUndefined()
    expect(script.dialogId).toBe('innkeeper')
    expect(dialogGraphsStructurallyEqual(compileDialogScript(script), golden)).toBe(true)
  })

  it('parses choice branches with two options', () => {
    const { script } = parseDialogGraph(golden)
    const choice = script.commands.find((c) => c.type === 'showChoices')
    expect(choice?.type).toBe('showChoices')
    if (choice?.type === 'showChoices') {
      expect(choice.options).toHaveLength(2)
      expect(choice.options[0]?.text).toBe('A room')
    }
  })

  it('returns parseWarning for unsupported graph shapes', () => {
    const cyclic: DialogGraphJson = {
      dialogId: 'loop',
      startNode: 'a',
      nodes: {
        a: { type: 'text', character: 'X', text: 'Hi', next: 'b' },
        b: { type: 'text', character: 'X', text: 'Again', next: 'a' },
      },
    }
    const { script, parseWarning } = parseDialogGraph(cyclic)
    expect(parseWarning).toBeTruthy()
    expect(script.commands).toEqual([])
  })

  it('compileDialogScript handles empty command list', () => {
    const graph = compileDialogScript({ dialogId: 'empty', commands: [] })
    expect(graph.dialogId).toBe('empty')
    const endNode = Object.values(graph.nodes).find((n) => n.type === 'end')
    expect(endNode).toBeDefined()
  })
})
