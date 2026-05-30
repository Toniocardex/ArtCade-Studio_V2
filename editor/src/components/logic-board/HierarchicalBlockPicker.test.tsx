/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HierarchicalBlockPicker } from './HierarchicalBlockPicker'

describe('HierarchicalBlockPicker', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onPick).toHaveBeenCalledWith(expect.any(String))
  })
})
