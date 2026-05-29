import { describe, expect, it, vi } from 'vitest'
import { openLogicBoardForEntity } from './logic-board-navigation'

describe('openLogicBoardForEntity', () => {
  it('selects entity and sets logic mode', () => {
    const dispatch = vi.fn()
    openLogicBoardForEntity(dispatch, 42)
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SELECT_ENTITY', entityId: 42 })
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET_MODE', mode: 'logic' })
  })
})
