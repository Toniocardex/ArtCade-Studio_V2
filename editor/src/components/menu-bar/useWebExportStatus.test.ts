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
  it('passes through the export state unchanged', () => {
    expect(mapWebExportToolbar(ready).exportState).toBe('ready')
    expect(mapWebExportToolbar(stale).exportState).toBe('stale')
    expect(mapWebExportToolbar(missing).exportState).toBe('missing')
  })
})
