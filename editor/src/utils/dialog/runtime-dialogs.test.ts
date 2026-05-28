import { describe, expect, it } from 'vitest'
import { dialogsJsonForRuntime } from './runtime-dialogs'
import { starterInnkeeperScript } from './dialog-file-api'

describe('dialogsJsonForRuntime', () => {
  it('compiles dialog scripts to a JSON array', () => {
    const json = dialogsJsonForRuntime({ innkeeper: starterInnkeeperScript() })
    const parsed = JSON.parse(json) as { dialogId: string }[]
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0]?.dialogId).toBe('innkeeper')
  })
})
