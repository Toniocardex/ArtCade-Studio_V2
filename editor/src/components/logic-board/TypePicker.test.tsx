/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TypePicker } from './TypePicker'

afterEach(() => cleanup())

describe('TypePicker', () => {
  it('shows placeholder on the trigger when value is empty', () => {
    render(
      <TypePicker
        kind="action"
        types={['playSound', 'destroyEntity']}
        value=""
        onChange={() => {}}
        placeholder="Select action…"
        placeholderValue="__none__"
      />,
    )
    expect(screen.getByText('Select action…')).toBeTruthy()
  })

  it('opens the listbox and calls onChange when an option is chosen', () => {
    const onChange = vi.fn()
    render(
      <TypePicker
        kind="action"
        types={['playSound', 'destroyEntity']}
        value="__none__"
        onChange={onChange}
        placeholder="Select action…"
        placeholderValue="__none__"
      />,
    )

    fireEvent.click(screen.getByText('Select action…').closest('button')!)
    fireEvent.click(screen.getByRole('option', { name: 'Play sound' }))

    expect(onChange).toHaveBeenCalledWith('playSound')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('selects the highlighted option with ArrowDown then Enter on the trigger', () => {
    const onChange = vi.fn()
    render(
      <TypePicker
        kind="action"
        types={['playSound']}
        value="__none__"
        onChange={onChange}
        placeholder="Select action…"
        placeholderValue="__none__"
      />,
    )

    const trigger = screen.getByText('Select action…').closest('button')!
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(trigger, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('playSound')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes on Escape without calling onChange', () => {
    const onChange = vi.fn()
    render(
      <TypePicker
        kind="trigger"
        types={['onInput', 'onTimer']}
        value=""
        onChange={onChange}
        placeholder="Quick add trigger…"
        placeholderValue=""
      />,
    )

    const trigger = screen.getByText('Quick add trigger…').closest('button')!
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeTruthy()

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
})
