import { describe, expect, it } from 'vitest'
import type { LogicEvent } from '../../types/logic-board'
import { emitGuardedBranches } from './emit-guarded-branches'

const slugs = new Map([['e1', 'test_rule']])

function baseEvent(overrides: Partial<LogicEvent> = {}): LogicEvent {
  return {
    id: 'e1',
    enabled: true,
    trigger: { type: 'onUpdate' },
    actions: [{ type: 'debugLog', message: 'then' }],
    ...overrides,
  }
}

describe('emitGuardedBranches', () => {
  it('wraps enable outside condition if/else', () => {
    const lua = emitGuardedBranches(
      baseEvent({
        onlyIfEnabled: true,
        conditions: [
          { type: 'compareVariable', key: 'hasKey', operator: '==', value: 1 },
        ],
        elseEnabled: true,
        elseActions: [{ type: 'debugLog', message: 'else' }],
      }),
      '',
      slugs,
    ).join('\n')
    expect(lua).toMatch(
      /if _logic_on\[RULE\.test_rule\] ~= false then[\s\S]*if \(global\.get\("hasKey"\) == 1\) then[\s\S]*else[\s\S]*end[\s\S]*end/,
    )
  })

  it('omits else when elseEnabled without conditions', () => {
    const lua = emitGuardedBranches(
      baseEvent({
        elseEnabled: true,
        elseActions: [{ type: 'debugLog', message: 'else' }],
      }),
      '',
      slugs,
    ).join('\n')
    expect(lua).not.toContain('else')
  })

  it('merges triggerGate into inner condition', () => {
    const lua = emitGuardedBranches(
      baseEvent({
        onlyIfEnabled: true,
        conditions: [{ type: 'isPlatformerGrounded', target: 'self' }],
      }),
      '',
      slugs,
      { triggerGate: 'input.isKeyDown("Space")' },
    ).join('\n')
    expect(lua).toContain('input.isKeyDown("Space")')
    expect(lua).toContain('platformer.isGrounded')
  })
})
