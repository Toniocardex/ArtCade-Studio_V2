import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseProjectDocWithMeta, unsupportedProjectFormatMessage } from './project-codec'

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

  it('reports unsupported future project format versions', () => {
    const message = unsupportedProjectFormatMessage(JSON.stringify({
      projectName: 'Future',
      version: '9.9.9',
      formatVersion: 999,
    }))

    expect(message).toContain('Project format v999 is newer')
    expect(parseProjectDocWithMeta(JSON.stringify({
      projectName: 'Future',
      version: '9.9.9',
      formatVersion: 999,
    }))).toBeNull()
  })
})
