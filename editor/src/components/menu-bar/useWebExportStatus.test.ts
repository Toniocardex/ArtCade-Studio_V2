import { describe, it, expect } from 'vitest'
import { mapWebExportToolbar } from './useWebExportStatus'
import type { WebExportStatus } from '../../utils/api'

const ready: WebExportStatus = {
  state: 'ready',
  distDir: '/tmp/dist/Game-web',
  hint: 'Open last web export in browser (localhost)',
}

const stale: WebExportStatus = {
  state: 'stale',
  distDir: '/tmp/dist/Game-web',
  hint: 'Project changed — run BUILD WEB to refresh export',
}

const missing: WebExportStatus = {
  state: 'missing',
  distDir: '',
  hint: 'Run BUILD WEB first to create a browser export',
}

describe('mapWebExportToolbar', () => {
  it('enables OPEN only when export is ready and project is loaded', () => {
    expect(mapWebExportToolbar(ready, true, false).canOpenInBrowser).toBe(true)
    expect(mapWebExportToolbar(ready, false, false).canOpenInBrowser).toBe(false)
    expect(mapWebExportToolbar(ready, true, true).canOpenInBrowser).toBe(false)
    expect(mapWebExportToolbar(stale, true, false).canOpenInBrowser).toBe(false)
    expect(mapWebExportToolbar(missing, true, false).canOpenInBrowser).toBe(false)
  })

  it('maps export status hints', () => {
    expect(mapWebExportToolbar(ready, true, false).exportStatusHint).toBe('Export ready')
    expect(mapWebExportToolbar(stale, true, false).exportStatusHint).toBe('Export outdated')
    expect(mapWebExportToolbar(missing, true, false).exportStatusHint).toBe('No export')
    expect(mapWebExportToolbar(stale, true, false).buildWebHint).toBe('Refresh browser export')
  })

  it('uses backend hint when OPEN is disabled for stale export', () => {
    const { openDisabledReason } = mapWebExportToolbar(stale, true, false)
    expect(openDisabledReason).toBe(stale.hint)
  })
})
