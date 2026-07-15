import { describe, expect, it } from 'vitest'
import { composeProjectLua } from './project-lua-composer'
import {
  extractManualMainLua,
  isComposedMainLua,
  migrateLegacyGeneratedMainLua,
} from './project-main-script'

describe('composed main.lua ship authority', () => {
  it('round-trips My Script through MANUAL markers', () => {
    const manual = 'function tick(dt)\n  debug.log("hi")\nend\n'
    const composed = composeProjectLua({
      manualLua: manual,
      generatedLua: 'local __artcade_logic = {}\n',
      projectKey: '/tmp/p',
    }).combinedLua
    expect(isComposedMainLua(composed)).toBe(true)
    expect(extractManualMainLua(composed)).toBe(manual)
  })

  it('migrateLegacy extracts manual from composed disk main', () => {
    const manual = 'x = 1\n'
    const composed = composeProjectLua({
      manualLua: manual,
      generatedLua: '-- gen',
      projectKey: 'k',
    }).combinedLua
    const migration = migrateLegacyGeneratedMainLua(composed)
    expect(migration.migrated).toBe(false)
    expect(migration.content).toBe(manual)
  })
})
