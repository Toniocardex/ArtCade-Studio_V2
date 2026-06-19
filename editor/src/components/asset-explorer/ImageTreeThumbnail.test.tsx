/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ImageTreeThumbnail } from './ImageTreeThumbnail'
import type { ImageAsset } from '../../types'

const asset: ImageAsset = {
  id: 'img1',
  name: 'hero.png',
  path: 'assets/images/hero.png',
  usage: 'sprite',
  dataUrl: 'data:image/png;base64,AA==',
}

describe('ImageTreeThumbnail', () => {
  it('uses pointer passthrough so the tree row handles click and drag', () => {
    const onOpenStudio = vi.fn()
    const { container } = render(
      <ImageTreeThumbnail asset={asset} projectPath={null} onOpenStudio={onOpenStudio} />,
    )
    const thumb = container.querySelector('img')
    expect(thumb).toBeTruthy()
    expect(thumb?.className).toContain('pointer-events-none')
    fireEvent.click(thumb!)
    fireEvent.doubleClick(thumb!)
    expect(onOpenStudio).not.toHaveBeenCalled()
  })
})
