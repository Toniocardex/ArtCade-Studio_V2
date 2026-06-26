// ---------------------------------------------------------------------------
// solid-color-png — deterministic 8-bit RGB PNG for prototype sprites (no canvas)
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const chunk = new Uint8Array(4 + 4 + data.length + 4)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length, false)
  chunk.set(typeBytes, 4)
  chunk.set(data, 8)
  const crcInput = new Uint8Array(typeBytes.length + data.length)
  crcInput.set(typeBytes, 0)
  crcInput.set(data, typeBytes.length)
  view.setUint32(8 + data.length, crc32(crcInput), false)
  return chunk
}

function adler32(data: Uint8Array): number {
  let a = 1
  let b = 0
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function zlibStore(raw: Uint8Array): Uint8Array {
  const len = raw.length
  const out = new Uint8Array(2 + 5 + len + 4)
  out[0] = 0x78
  out[1] = 0x01
  out[2] = 0x01
  out[3] = len & 0xff
  out[4] = (len >> 8) & 0xff
  out[5] = (~len) & 0xff
  out[6] = ((~len) >> 8) & 0xff
  out.set(raw, 7)
  new DataView(out.buffer).setUint32(7 + len, adler32(raw), false)
  return out
}

/** Encode a solid-color 8-bit RGB PNG. */
export function solidColorPngBytes(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8Array {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const rowLen = 1 + w * 3
  const raw = new Uint8Array(rowLen * h)
  for (let y = 0; y < h; y++) {
    const row = y * rowLen
    raw[row] = 0
    for (let x = 0; x < w; x++) {
      const px = row + 1 + x * 3
      raw[px] = r
      raw[px + 1] = g
      raw[px + 2] = b
    }
  }

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, w, false)
  ihdrView.setUint32(4, h, false)
  ihdr[8] = 8
  ihdr[9] = 2

  const parts = [
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlibStore(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function pngBytesToDataUrl(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return `data:image/png;base64,${btoa(binary)}`
}
