import { describe, it, expect } from 'vitest'
import { emitActionSequence } from './emit-action-sequence'
import type { LogicAction } from '../../types/logic-board'

const slugs = new Map<string, string>()

describe('emitActionSequence', () => {
  it('emits linear actions with the given indent', () => {
    const lines = emitActionSequence(
      [{ type: 'debugLog', message: 'hi' }],
      '  ',
      slugs,
    )
    expect(lines).toEqual(['  debug.log("hi")'])
  })

  it('wait wraps remainder in time.after and returns early', () => {
    const lines = emitActionSequence(
      [
        { type: 'wait', seconds: 1.25 },
        { type: 'debugLog', message: 'after' },
      ],
      '',
      slugs,
    )
    expect(lines[0]).toBe('time.after(1.25, function()')
    expect(lines).toContain('  debug.log("after")')
    expect(lines.at(-1)).toBe('end)')
  })

  it('wait then-branch is emitted before following actions', () => {
    const lines = emitActionSequence(
      [
        {
          type: 'wait',
          seconds: 0.5,
          then: [{ type: 'debugLog', message: 'then' }],
        },
        { type: 'debugLog', message: 'tail' },
      ],
      '',
      slugs,
    )
    const thenIdx = lines.indexOf('  debug.log("then")')
    const tailIdx = lines.indexOf('  debug.log("tail")')
    expect(thenIdx).toBeGreaterThan(-1)
    expect(tailIdx).toBeGreaterThan(thenIdx)
  })

  it('repeatTimes with interval 0 uses a for loop', () => {
    const lines = emitActionSequence(
      [
        { type: 'repeatTimes', count: 3, intervalSeconds: 0 },
        { type: 'debugLog', message: 'tick' },
      ],
      '  ',
      slugs,
    )
    expect(lines).toContain('  for _logic_rep = 1, 3 do')
    expect(lines).toContain('    debug.log("tick")')
    expect(lines).toContain('  end')
    expect(lines.some((l) => l.includes('time.after'))).toBe(false)
  })

  it('repeatTimes with interval > 0 uses stepped time.after', () => {
    const lines = emitActionSequence(
      [
        { type: 'repeatTimes', count: 2, intervalSeconds: 0.25 },
        { type: 'debugLog', message: 'step' },
      ],
      '',
      slugs,
    )
    expect(lines.some((l) => l.includes('local function _logic_rep_step_'))).toBe(true)
    expect(lines.some((l) => l.includes('time.after(0.25') && l.includes('_logic_rep_step_'))).toBe(true)
    expect(lines).toContain('  debug.log("step")')
  })

  it('repeatTimes nested actions array avoids consuming trailing controls', () => {
    const actions: LogicAction[] = [
      {
        type: 'repeatTimes',
        count: 2,
        intervalSeconds: 0,
        actions: [{ type: 'debugLog', message: 'inner' }],
      },
      { type: 'debugLog', message: 'outer' },
    ]
    const lines = emitActionSequence(actions, '', slugs)
    expect(lines.filter((l) => l.includes('inner'))).toHaveLength(1)
    expect(lines).toContain('debug.log("outer")')
  })

  it('repeatTimes linear body stops at the next wait', () => {
    const lines = emitActionSequence(
      [
        { type: 'repeatTimes', count: 2, intervalSeconds: 0 },
        { type: 'debugLog', message: 'in-loop' },
        { type: 'wait', seconds: 1 },
        { type: 'debugLog', message: 'after-wait' },
      ],
      '',
      slugs,
    )
    const forIdx = lines.findIndex((l) => l.includes('for _logic_rep'))
    const forEndIdx = lines.findIndex((l, i) => i > forIdx && l === 'end')
    const loopBody = lines.slice(forIdx, forEndIdx + 1)
    expect(loopBody.some((l) => l.includes('in-loop'))).toBe(true)
    expect(loopBody.some((l) => l.includes('after-wait'))).toBe(false)
    expect(lines.some((l) => l.includes('time.after(1'))).toBe(true)
    expect(lines.some((l) => l.includes('after-wait'))).toBe(true)
  })

  it('assigns unique repeat step names across nested timed repeats', () => {
    const lines = emitActionSequence(
      [
        {
          type: 'wait',
          seconds: 0,
          then: [
            {
              type: 'repeatTimes',
              count: 2,
              intervalSeconds: 0.1,
              actions: [{ type: 'debugLog', message: 'a' }],
            },
            {
              type: 'repeatTimes',
              count: 2,
              intervalSeconds: 0.1,
              actions: [{ type: 'debugLog', message: 'b' }],
            },
          ],
        },
      ],
      '',
      slugs,
      { next: 0 },
    )
    const stepFns = lines.filter((l) => l.includes('local function _logic_rep_step_'))
    expect(stepFns.length).toBeGreaterThanOrEqual(2)
    expect(new Set(stepFns).size).toBe(2)
  })
})
