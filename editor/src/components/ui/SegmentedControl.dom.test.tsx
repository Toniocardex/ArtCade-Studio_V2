/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
]

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SegmentedControl', () => {
  it('emits the clicked option value', () => {
    const onChange = vi.fn()
    render(<SegmentedControl value="auto" onChange={onChange} options={OPTIONS} />)

    fireEvent.click(screen.getByRole('radio', { name: 'On' }))
    expect(onChange).toHaveBeenCalledWith('on')
  })

  it('marks only the selected segment checked and tabbable', () => {
    render(<SegmentedControl value="auto" onChange={() => {}} options={OPTIONS} />)

    const radios = screen.getAllByRole('radio')
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toBe('Auto')
    expect(checked[0].getAttribute('tabindex')).toBe('0')
    for (const other of radios.filter((r) => r !== checked[0])) {
      expect(other.getAttribute('tabindex')).toBe('-1')
    }
  })

  it('moves selection with arrow keys and wraps around', () => {
    const onChange = vi.fn()
    render(<SegmentedControl value="on" onChange={onChange} options={OPTIONS} />)

    const group = screen.getByRole('radiogroup')
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('off')

    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('auto')
  })

  it('jumps to first and last segment with Home and End', () => {
    const onChange = vi.fn()
    render(<SegmentedControl value="auto" onChange={onChange} options={OPTIONS} />)

    const group = screen.getByRole('radiogroup')
    fireEvent.keyDown(group, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('on')

    fireEvent.keyDown(group, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('off')
  })
})
