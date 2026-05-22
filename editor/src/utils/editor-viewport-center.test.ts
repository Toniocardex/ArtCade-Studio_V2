import { describe, it, expect } from 'vitest'
import { computeVisibleWorldCenter } from './editor-viewport-center'

describe('computeVisibleWorldCenter', () => {
  it('maps scroll viewport centre to world coordinates', () => {
    expect(computeVisibleWorldCenter(200, 100, 400, 300, 2)).toEqual({ x: 200, y: 125 })
  })

  it('guards against zero zoom', () => {
    expect(computeVisibleWorldCenter(0, 0, 800, 600, 0)).toEqual({ x: 400, y: 300 })
  })
})
