import { describe, it, expect } from 'vitest'
import { computeVisibleWorldCenter } from './editor-viewport-center'

describe('computeVisibleWorldCenter', () => {
  it('maps viewport centre to world coordinates from camera top-left', () => {
    expect(computeVisibleWorldCenter(0, 0, 400, 300, 2)).toEqual({ x: 100, y: 75 })
  })

  it('treats zero zoom as 1', () => {
    expect(computeVisibleWorldCenter(0, 0, 800, 600, 0)).toEqual({ x: 400, y: 300 })
  })
})
