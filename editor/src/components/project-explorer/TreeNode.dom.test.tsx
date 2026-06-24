/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TreeLeaf } from './TreeNode'
import { ExplorerRowAction } from './explorer-cta'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TreeLeaf', () => {
  it('renders actions for non-draggable rows', () => {
    const onClick = vi.fn()
    const onAction = vi.fn()
    render(
      <TreeLeaf
        label="Player"
        onClick={onClick}
        actions={
          <ExplorerRowAction
            title="Rename object"
            onClick={(ev) => {
              ev.stopPropagation()
              onAction()
            }}
          >
            R
          </ExplorerRowAction>
        }
      />,
    )

    fireEvent.click(screen.getByLabelText('Rename object'))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })
})
