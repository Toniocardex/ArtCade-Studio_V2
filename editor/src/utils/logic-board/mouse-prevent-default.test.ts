import { describe, expect, it } from 'vitest'
import {
  applyMousePreventDefaultDefaults,
  defaultPreventDefaultAction,
  destroyOtherTargetWarning,
} from './mouse-prevent-default'
import type { LogicEvent } from '../../types/logic-board'

function mouseEvent(
  button: 'left' | 'right',
  actions: LogicEvent['actions'] = [],
): LogicEvent {
  return {
    id: 'e1',
    enabled: true,
    trigger: { type: 'onMouseInput', button, eventType: 'pressed' },
    actions,
  }
}

describe('applyMousePreventDefaultDefaults', () => {
  it('prepends preventDefault for left mouse rules', () => {
    const out = applyMousePreventDefaultDefaults(
      mouseEvent('left', [{ type: 'destroyEntity', target: 'self' }]),
    )
    expect(out.actions[0]).toEqual(defaultPreventDefaultAction('left'))
    expect(out.actions[1]?.type).toBe('destroyEntity')
  })

  it('prepends preventDefault for right mouse rules', () => {
    const out = applyMousePreventDefaultDefaults(mouseEvent('right'))
    expect(out.actions[0]).toEqual(defaultPreventDefaultAction('right'))
  })

  it('does not duplicate when already present', () => {
    const out = applyMousePreventDefaultDefaults(
      mouseEvent('right', [
        defaultPreventDefaultAction('right'),
        { type: 'destroyEntity', target: 'self' },
      ]),
    )
    expect(out.actions.filter((a) => a.type === 'preventDefault')).toHaveLength(1)
  })

  it('warns when Destroy targets other on mouse trigger', () => {
    expect(
      destroyOtherTargetWarning(
        { type: 'destroyEntity', target: 'other' },
        { type: 'onMouseInput', button: 'right', eventType: 'pressed' },
      ),
    ).toMatch(/This object/)
    expect(
      destroyOtherTargetWarning(
        { type: 'destroyEntity', target: 'self' },
        { type: 'onMouseInput', button: 'right', eventType: 'pressed' },
      ),
    ).toBeNull()
  })

  it('ignores non-mouse triggers', () => {
    const out = applyMousePreventDefaultDefaults({
      id: 'e1',
      enabled: true,
      trigger: { type: 'onUpdate' },
      actions: [{ type: 'debugLog', message: 'x' }],
    })
    expect(out.actions).toHaveLength(1)
    expect(out.actions[0]?.type).toBe('debugLog')
  })
})
