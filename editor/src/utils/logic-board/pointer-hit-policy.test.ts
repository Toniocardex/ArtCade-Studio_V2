import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

const POLICY_FILES = [
  'emit-event-body.ts',
  'condition-expr.ts',
  'action-emitter.ts',
  'lua-helpers.ts',
]

/** Strip line comments so policy checks do not false-positive on documentation. */
function stripLineComments(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

describe('Logic Board pointer hit policy', () => {
  for (const file of POLICY_FILES) {
    it(`${file} does not use input.mousePosition() for pointer gameplay`, () => {
      const raw = readFileSync(join(here, file), 'utf8')
      const source = stripLineComments(raw)
      expect(source).not.toContain('input.mousePosition()')
    })
  }

  it('spawnEntityAtPointer uses luaPointerWorldPairStmt', () => {
    const source = readFileSync(join(here, 'action-emitter.ts'), 'utf8')
    expect(source).toContain('luaPointerWorldPairStmt()')
  })

  it('lua-helpers exports pointer world helpers', () => {
    const source = readFileSync(join(here, 'lua-helpers.ts'), 'utf8')
    expect(source).toContain('export function luaPointerNearSelfExpr')
    expect(source).toContain('export function luaPointerWorldPairStmt')
    expect(source).toContain('input.mouseWorld()')
  })
})
