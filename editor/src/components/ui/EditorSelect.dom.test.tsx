/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EditorSelect } from './EditorSelect'

const OPTIONS = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'gamma', label: 'Gamma' },
]

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('EditorSelect', () => {
  it('selects an option and restores focus to the trigger', () => {
    const onChange = vi.fn()
    render(<EditorSelect value="alpha" onChange={onChange} options={OPTIONS} />)

    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }))

    expect(onChange).toHaveBeenCalledWith('beta')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps options out of the tab order and exposes the active option', () => {
    render(<EditorSelect value="beta" onChange={() => {}} options={OPTIONS} />)

    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const activeId = trigger.getAttribute('aria-activedescendant')
    expect(activeId).toBeTruthy()
    expect(document.getElementById(activeId!)?.textContent).toBe('Beta')
    for (const option of screen.getAllByRole('option')) {
      expect(option.getAttribute('tabindex')).toBe('-1')
    }
  })

  it('closes on Tab without preventing normal focus traversal', () => {
    render(<EditorSelect value="alpha" onChange={() => {}} options={OPTIONS} />)

    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    const allowed = fireEvent.keyDown(trigger, { key: 'Tab' })

    expect(allowed).toBe(true)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('supports Home, End and first-letter navigation on the trigger', () => {
    const onChange = vi.fn()
    render(<EditorSelect value="alpha" onChange={onChange} options={OPTIONS} />)

    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'End' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('gamma')

    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'b' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('beta')
  })

  it('repositions the portal on nested scroll and window resize', () => {
    render(<EditorSelect value="alpha" onChange={() => {}} options={OPTIONS} />)

    const trigger = screen.getByRole('combobox')
    let top = 20
    vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(() => ({
      x: 30,
      y: top,
      top,
      left: 30,
      right: 150,
      bottom: top + 24,
      width: 120,
      height: 24,
      toJSON: () => ({}),
    }))

    fireEvent.click(trigger)
    const menu = screen.getByRole('listbox').parentElement!
    expect(menu.style.top).toBe('48px')

    top = 80
    fireEvent.scroll(document)
    expect(menu.style.top).toBe('108px')

    top = 120
    fireEvent(window, new Event('resize'))
    expect(menu.style.top).toBe('148px')
  })
})
