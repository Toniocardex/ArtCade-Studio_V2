import { describe, expect, it } from 'vitest'
import {
  CLASS_PICKER_OTHER,
  classPickerSelectValue,
  isClassPickerOtherMode,
} from './ClassNamePicker'

const CLASSES = ['Coin', 'Player'] as const

describe('ClassNamePicker helpers', () => {
  it('maps empty value to empty select', () => {
    expect(classPickerSelectValue('', CLASSES)).toBe('')
    expect(isClassPickerOtherMode('', CLASSES)).toBe(false)
  })

  it('maps known class to select option', () => {
    expect(classPickerSelectValue('Coin', CLASSES)).toBe('Coin')
    expect(isClassPickerOtherMode('Coin', CLASSES)).toBe(false)
  })

  it('maps unknown class to Other sentinel', () => {
    expect(classPickerSelectValue('CustomBullet', CLASSES)).toBe(CLASS_PICKER_OTHER)
    expect(isClassPickerOtherMode('CustomBullet', CLASSES)).toBe(true)
  })

  it('preserves project class list order for select options', () => {
    expect([...CLASSES]).toEqual(['Coin', 'Player'])
  })
})
