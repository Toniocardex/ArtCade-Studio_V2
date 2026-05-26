import { describe, expect, it } from 'vitest'
import { getOnInputKeyCodes, onInputGateExpr } from './on-input-keys'

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
})
