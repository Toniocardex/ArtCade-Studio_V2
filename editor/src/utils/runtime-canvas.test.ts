// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import {
  bindRuntimeSurfaceToHost,
  getRuntimeCanvas,
  parkRuntimeCanvasOnBody,
  unbindRuntimeSurface,
} from './runtime-canvas'

describe('runtime-canvas SurfaceBinder', () => {
  afterEach(() => {
    unbindRuntimeSurface()
    const canvas = getRuntimeCanvas()
    canvas.style.cssText = ''
  })

  it('returns false when host is missing', () => {
    expect(bindRuntimeSurfaceToHost(null)).toBe(false)
  })

  it('pins the canvas on body and positions it over the host', () => {
    const canvas = getRuntimeCanvas()
    const host = document.createElement('div')
    host.style.position = 'fixed'
    host.style.left = '40px'
    host.style.top = '80px'
    host.style.width = '320px'
    host.style.height = '180px'
    document.body.appendChild(host)

    // happy-dom may report 0 rects; still must keep parent === body.
    expect(bindRuntimeSurfaceToHost(host, canvas)).toBe(true)
    expect(canvas.parentElement).toBe(document.body)
    expect(canvas.isConnected).toBe(true)
    expect(canvas.style.position).toBe('fixed')

    host.remove()
    unbindRuntimeSurface()
  })

  it('parks on body without detach', () => {
    const canvas = getRuntimeCanvas()
    const host = document.createElement('div')
    document.body.appendChild(host)
    bindRuntimeSurfaceToHost(host, canvas)

    parkRuntimeCanvasOnBody(canvas)
    expect(canvas.parentElement).toBe(document.body)
    expect(canvas.isConnected).toBe(true)
    expect(canvas.style.pointerEvents).toBe('none')

    host.remove()
  })

  it('never reparents into the React host', () => {
    const canvas = getRuntimeCanvas()
    const host = document.createElement('div')
    document.body.appendChild(host)
    bindRuntimeSurfaceToHost(host, canvas)
    expect(canvas.parentElement).toBe(document.body)
    expect(host.contains(canvas)).toBe(false)
    host.remove()
  })
})
