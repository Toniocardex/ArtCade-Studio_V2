import { describe, expect, it } from 'vitest'
import { BLANK_MAIN_LUA } from './project-factory'
import {
  LEGACY_GENERATED_LUA_MARKER,
  migrateLegacyGeneratedMainLua,
} from './project-main-script'

describe('migrateLegacyGeneratedMainLua', () => {
  it('resets only legacy generated main scripts and marks the replacement dirty', () => {
    expect(migrateLegacyGeneratedMainLua(`-- ${LEGACY_GENERATED_LUA_MARKER}`)).toEqual({
      content: BLANK_MAIN_LUA,
      isDirty: true,
      migrated: true,
    })
  })

  it('preserves manual scripts byte-for-byte', () => {
    const source = '-- manual\nfunction tick(dt) end\n'
    expect(migrateLegacyGeneratedMainLua(source)).toEqual({
      content: source,
      isDirty: false,
      migrated: false,
    })
  })
})
