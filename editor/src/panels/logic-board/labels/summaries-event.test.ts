import { describe, it, expect } from 'vitest'
import { ruleSentenceParts } from './summaries-event'
import type { LogicEvent } from '../../../types/logic-board'

function baseEvent(overrides: Partial<LogicEvent> = {}): LogicEvent {
  return {
    id: 'e1',
    enabled: true,
    trigger: { type: 'onInput', keyCode: 'Space', eventType: 'pressed' },
    actions: [],
    ...overrides,
  }
}

describe('ruleSentenceParts', () => {
  it('flags rules without actions as incomplete', () => {
    const s = ruleSentenceParts(baseEvent())
    expect(s.when).toContain('Space')
    expect(s.missingActions).toBe(true)
    expect(s.actions).toBe('')
  })

  it('joins action summaries with a separator', () => {
    const s = ruleSentenceParts(
      baseEvent({
        actions: [
          { type: 'playSound', path: 'sfx/jump.ogg' },
          { type: 'requestPlatformerJump', target: 'self' },
        ],
      }),
    )
    expect(s.missingActions).toBe(false)
    expect(s.actions).toContain('Play sound "sfx/jump.ogg"')
    expect(s.actions).toContain(' · ')
    // Regression: target lambdas must be invoked, not stringified.
    expect(s.actions).toContain('Make This object jump')
    expect(s.actions).not.toContain('=>')
  })

  it('summarizes active checks and else branch', () => {
    const s = ruleSentenceParts(
      baseEvent({
        onlyIfEnabled: true,
        conditions: [
          { type: 'compareVariable', key: 'coins', operator: '>=', value: 1 },
        ],
        actions: [{ type: 'restartScene' }],
        elseEnabled: true,
        elseActions: [{ type: 'debugLog', message: 'no' }],
      }),
    )
    expect(s.checks).toBe('if Variable coins >= 1')
    expect(s.actions).toContain('Restart current level')
    expect(s.actions).toContain('else: 1 action')
  })

  it('omits checks when Also require is disabled', () => {
    const s = ruleSentenceParts(
      baseEvent({
        onlyIfEnabled: false,
        conditions: [
          { type: 'compareVariable', key: 'coins', operator: '>=', value: 1 },
        ],
        actions: [{ type: 'restartScene' }],
      }),
    )
    expect(s.checks).toBe('')
  })
})
