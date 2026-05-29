import { describe, expect, it } from 'vitest'
import { parseZipEntries } from './artcade-zip-io'

describe('artcade-zip-io', () => {
  it('parseZipEntries rejects non-ZIP bytes', () => {
    expect(() => parseZipEntries(new Uint8Array([0, 1, 2]))).toThrow(
      /end of central directory not found/,
    )
  })
})
