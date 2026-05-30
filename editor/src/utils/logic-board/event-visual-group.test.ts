import { describe, expect, it } from 'vitest'
import type { LogicEvent } from '../../types/logic-board'
import {
  eventVisualGroup,
  groupEventsByVisualCategory,
  orderedVisualGroups,
} from './event-visual-group'

function ev(
  trigger: LogicEvent['trigger'] | LogicEvent['trigger']['type'],
  actions: LogicEvent['actions'] = [],
): LogicEvent {
  const resolved =
    typeof trigger === 'string'
      ? ({ type: trigger } as LogicEvent['trigger'])
      : trigger
  return {
    id: 'e1',
    enabled: true,
    trigger: resolved,
    actions,
  }
}

describe('eventVisualGroup', () => {
  it('maps onInput to Input', () => {
    expect(eventVisualGroup(ev('onInput'))).toBe('Input')
  })

  it('maps collision triggers to Combat', () => {
    expect(eventVisualGroup(ev('onCollision'))).toBe('Combat')
  })

  it('maps movement actions to Movement when trigger is not a fixed category', () => {
    expect(
      eventVisualGroup(
        ev({ type: 'onMessage', messageName: 'jump' }, [
          { type: 'controllerMovement', axis: 'horizontal', speed: 100 },
        ]),
      ),
    ).toBe('Movement')
  })
})

describe('orderedVisualGroups', () => {
  it('returns groups in fixed order with only non-empty buckets', () => {
    const map = groupEventsByVisualCategory([
      ev('onTimer'),
      ev('onInput'),
    ])
    const ordered = orderedVisualGroups(map)
    expect(ordered.map((g) => g.group)).toEqual(['Input', 'Time'])
    expect(ordered[0]?.events).toHaveLength(1)
    expect(ordered[1]?.events).toHaveLength(1)
  })
})
