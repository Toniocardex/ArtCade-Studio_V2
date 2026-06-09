/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HierarchicalBlockPicker } from './HierarchicalBlockPicker'

describe('HierarchicalBlockPicker', () => {
  afterEach(() => {
    cleanup()
  })

  it('calls onPick when a block row is clicked with pickOnSelect', () => {
    const onPick = vi.fn()
    render(
      <HierarchicalBlockPicker
        kind="trigger"
        types={['onStart', 'onInput']}
        title="Add trigger"
        pickOnSelect
        onClose={() => {}}
        onPick={onPick}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Input' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard key' }))
    expect(onPick).toHaveBeenCalledWith('onInput')
  })

  it('calls onPick with default block when Add is pressed', () => {
    const onPick = vi.fn()
    render(
      <HierarchicalBlockPicker
        kind="trigger"
        types={['onStart', 'onInput']}
        title="Add trigger"
        onClose={() => {}}
        onPick={onPick}
      />,
    )
    fireEvent.click(screen.getByTestId('hierarchical-block-picker').querySelector('footer button')!)
    expect(onPick).toHaveBeenCalledWith(expect.any(String))
  })
})
