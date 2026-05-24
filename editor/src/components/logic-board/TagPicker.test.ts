import { describe, expect, it } from 'vitest'
import {
  isTagPickerOtherMode,
  tagPickerSelectValue,
  TAG_PICKER_OTHER,
} from './TagPicker'

describe('TagPicker helpers', () => {
  const tags = ['player', 'pickup', 'enemy']

  it('tagPickerSelectValue maps known tags', () => {
    expect(tagPickerSelectValue('player', tags)).toBe('player')
    expect(tagPickerSelectValue('', tags)).toBe('')
  })

  it('tagPickerSelectValue maps unknown to Other', () => {
    expect(tagPickerSelectValue('custom', tags)).toBe(TAG_PICKER_OTHER)
  })

  it('isTagPickerOtherMode', () => {
    expect(isTagPickerOtherMode('player', tags)).toBe(false)
    expect(isTagPickerOtherMode('custom', tags)).toBe(true)
    expect(isTagPickerOtherMode('', tags)).toBe(false)
  })
})
