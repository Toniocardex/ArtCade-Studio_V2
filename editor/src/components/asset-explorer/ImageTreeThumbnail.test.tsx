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
  dataUrl: 'data:image/png;base64,AA==',
}

describe('ImageTreeThumbnail', () => {
  it('opens studio on thumbnail double-click', () => {
    const onOpenStudio = vi.fn()
    const { container } = render(
      <ImageTreeThumbnail asset={asset} onOpenStudio={onOpenStudio} />,
    )
    const thumb = container.querySelector('img')
    expect(thumb).toBeTruthy()
    fireEvent.doubleClick(thumb!)
    expect(onOpenStudio).toHaveBeenCalledTimes(1)
  })
})
