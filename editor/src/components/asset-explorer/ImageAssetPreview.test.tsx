/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SPRITESHEET_STUDIO_TRIGGER_ATTR } from '../../panels/spritesheet-studio/openSpritesheetStudio'
import { ImageAssetPreview } from './ImageAssetPreview'
import type { ImageAsset } from '../../types'

const asset: ImageAsset = {
  id: 'img1',
  name: 'hero.png',
  path: 'assets/images/hero.png',
  usage: 'sprite',
  dataUrl: 'data:image/png;base64,AA==',
}

describe('ImageAssetPreview', () => {
  it('opens studio on Enter and double-click', () => {
    const onOpenStudio = vi.fn()
    render(
      <ImageAssetPreview asset={asset} projectPath={null} onOpenStudio={onOpenStudio} />,
    )
    const btn = screen.getByRole('button', { name: /Open Sprite Studio for hero.png/i })
    expect(btn.hasAttribute(SPRITESHEET_STUDIO_TRIGGER_ATTR)).toBe(true)
    fireEvent.keyDown(btn, { key: 'Enter' })
    expect(onOpenStudio).toHaveBeenCalledTimes(1)
    fireEvent.doubleClick(btn)
    expect(onOpenStudio).toHaveBeenCalledTimes(2)
  })
})
