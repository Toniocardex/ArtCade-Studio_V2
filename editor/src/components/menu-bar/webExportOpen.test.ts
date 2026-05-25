import { describe, it, expect, vi } from 'vitest'
import { planOpenWebExport } from './webExportOpen'

const ensureProjectOnDisk = vi.fn()

vi.mock('./ensureProjectOnDisk', () => ({
  ensureProjectOnDisk: (...args: unknown[]) => ensureProjectOnDisk(...args),
}))

describe('planOpenWebExport', () => {
  it('skips when export is not ready', () => {
    expect(planOpenWebExport('/games/MyGame/project.json', 'missing')).toEqual({ kind: 'skip' })
    expect(planOpenWebExport('/games/MyGame/project.json', 'stale')).toEqual({ kind: 'skip' })
    expect(planOpenWebExport(null, 'ready')).toEqual({ kind: 'skip' })
    expect(ensureProjectOnDisk).not.toHaveBeenCalled()
  })

  it('opens from project root without save/migrate when ready', () => {
    expect(planOpenWebExport('/games/MyGame/project.json', 'ready')).toEqual({
      kind: 'open',
      projectRoot: '/games/MyGame',
    })
    expect(ensureProjectOnDisk).not.toHaveBeenCalled()
  })
})
