import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseProjectDocWithMeta } from './project-codec'

describe('parseProjectDocWithMeta', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('returns null and logs when JSON is invalid', () => {
    expect(parseProjectDocWithMeta('{ not json')).toBeNull()
    expect(errorSpy).toHaveBeenCalled()
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('[project-codec]')
  })
})
