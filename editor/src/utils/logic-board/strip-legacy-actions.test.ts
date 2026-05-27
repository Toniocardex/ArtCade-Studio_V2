import { describe, expect, it } from 'vitest'
import { stripLegacyLogicActions } from './strip-legacy-actions'

describe('stripLegacyLogicActions', () => {
  it('removes preventDefault actions from saved projects', () => {
    const out = stripLegacyLogicActions([
      { type: 'preventDefault', button: 'right' },
      { type: 'destroyEntity', target: 'self' },
    ])
    expect(out).toEqual([{ type: 'destroyEntity', target: 'self' }])
  })
})
