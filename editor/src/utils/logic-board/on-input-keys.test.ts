import { describe, expect, it } from 'vitest'
import {
  getOnInputKeyCodes,
  getOnInputRegistrationKeys,
  onInputGateExpr,
} from './on-input-keys'

describe('on-input-keys', () => {
  it('dedupes primary and alternates', () => {
    expect(
      getOnInputKeyCodes({
        type: 'onInput',
        keyCode: 'KeyW',
        alternateKeyCodes: ['Space', 'KeyW'],
        eventType: 'pressed',
      }),
    ).toEqual(['KeyW', 'Space'])
  })

  it('builds OR gate for multiple keys', () => {
    const expr = onInputGateExpr({
      type: 'onInput',
      keyCode: 'KeyW',
      alternateKeyCodes: ['Space'],
      eventType: 'pressed',
    })
    expect(expr).toContain(' or ')
    expect(expr).toContain('wasKeyPressed')
    expect(expr).toContain('"KeyW"')
    expect(expr).toContain('"Space"')
  })

  it('builds AND gate with held modifiers on pressed', () => {
    const expr = onInputGateExpr({
      type: 'onInput',
      keyCode: 'KeyW',
      alternateKeyCodes: ['ControlLeft'],
      keyCombine: 'AND',
      eventType: 'pressed',
    })
    expect(expr).toContain(' and ')
    expect(expr).toContain('wasKeyPressed("KeyW")')
    expect(expr).toContain('input.isKeyDown("ControlLeft")')
  })

  it('AND pressed registers only the primary key', () => {
    expect(
      getOnInputRegistrationKeys({
        type: 'onInput',
        keyCode: 'KeyW',
        alternateKeyCodes: ['ControlLeft'],
        keyCombine: 'AND',
        eventType: 'pressed',
      }),
    ).toEqual(['KeyW'])
  })

  it('AND down uses isKeyDown for every key', () => {
    const expr = onInputGateExpr({
      type: 'onInput',
      keyCode: 'KeyW',
      alternateKeyCodes: ['ControlLeft'],
      keyCombine: 'AND',
      eventType: 'down',
    })
    expect(expr).not.toContain(' or ')
    expect(expr).toContain('input.isKeyDown("KeyW")')
    expect(expr).toContain('input.isKeyDown("ControlLeft")')
  })
})
