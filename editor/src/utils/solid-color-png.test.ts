import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { pngBytesToDataUrl, solidColorPngBytes } from './solid-color-png'

describe('solid-color-png', () => {
  it('encodes a 32x32 cyan PNG with valid signature and zlib IDAT', () => {
    const bytes = solidColorPngBytes(32, 32, 0, 188, 212)
    expect(bytes[0]).toBe(137)
    expect(bytes[1]).toBe(80)
    expect(bytes[2]).toBe(78)
    expect(bytes[3]).toBe(71)
    expect(bytes.length).toBeGreaterThan(200)
    const dataUrl = pngBytesToDataUrl(bytes)
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('decodes to the requested RGB via sharp (valid PNG chunk CRC)', async () => {
    const bytes = solidColorPngBytes(32, 32, 0, 188, 212)
    const { data, info } = await sharp(Buffer.from(bytes))
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect(info.width).toBe(32)
    expect(info.height).toBe(32)
    expect(data[0]).toBe(0)
    expect(data[1]).toBe(188)
    expect(data[2]).toBe(212)
  })
})
