import { describe, expect, it } from 'vitest'
import { LuaFactory } from 'wasmoon'
import { composeProjectLua } from './project-lua-composer'

describe('composeProjectLua', () => {
  it('wraps manual Lua without requiring a Logic Board source', async () => {
    const result = composeProjectLua({ manualLua: 'function tick(dt) end\n' })
    expect(result.generatedLua).toBe('')
    expect(result.combinedLua).toContain('rawset(_G, "tick", __artcade_user_tick)')
    const lua = await new LuaFactory().createEngine()
    await lua.doString(result.combinedLua)
    expect(typeof lua.global.get('tick')).toBe('function')
    lua.global.close()
  })

  it('runs Logic Board tick before the user tick', async () => {
    const lua = await new LuaFactory().createEngine()
    await lua.doString('calls = {}')
    const result = composeProjectLua({
      generatedLua: `local __artcade_logic = {
        initialize = function() end,
        dispose = function() end,
        tick = function() table.insert(calls, "board") end,
      }`,
      manualLua: 'function tick(dt) table.insert(calls, "user") end',
    })
    await lua.doString(result.combinedLua)
    ;(lua.global.get('tick') as (dt: number) => void)(1 / 60)
    expect(lua.global.get('calls')).toEqual(['board', 'user'])
    lua.global.close()
  })

  it('does not rerun unchanged user source on Logic Board hot reload', async () => {
    const lua = await new LuaFactory().createEngine()
    await lua.doString('loads = 0; calls = {}')
    const manualLua = 'loads = loads + 1; function tick(dt) table.insert(calls, "user") end'
    const generatedLua = (label: string) => `local __artcade_logic = {
      initialize = function() end,
      dispose = function() end,
      tick = function() table.insert(calls, "${label}") end,
    }`
    await lua.doString(composeProjectLua({ manualLua, generatedLua: generatedLua('one') }).combinedLua)
    await lua.doString(composeProjectLua({ manualLua, generatedLua: generatedLua('two') }).combinedLua)
    expect(lua.global.get('loads')).toBe(1)
    ;(lua.global.get('tick') as (dt: number) => void)(1 / 60)
    expect(lua.global.get('calls')).toEqual(['two', 'user'])
    lua.global.close()
  })

  it('preserves multiline string contents in My Script', async () => {
    const lua = await new LuaFactory().createEngine()
    const manualLua = 'manual_text = [[\nhello\n]]'
    await lua.doString(composeProjectLua({ manualLua }).combinedLua)
    expect(lua.global.get('manual_text')).toBe('hello\n')
    lua.global.close()
  })

  it('initializes Logic Board before running changed user source', async () => {
    const lua = await new LuaFactory().createEngine()
    await lua.doString('calls = {}')
    const result = composeProjectLua({
      generatedLua: `local __artcade_logic = {
        initialize = function() table.insert(calls, "initialize") end,
        dispose = function() end,
        tick = function() end,
      }`,
      manualLua: 'table.insert(calls, "manual")',
    })
    await lua.doString(result.combinedLua)
    expect(lua.global.get('calls')).toEqual(['initialize', 'manual'])
    lua.global.close()
  })

  it('disposes the previous Logic Board when all boards are removed', async () => {
    const lua = await new LuaFactory().createEngine()
    await lua.doString('disposed = 0')
    const generatedLua = `local __artcade_logic = {
      initialize = function() end,
      dispose = function() disposed = disposed + 1 end,
      tick = function() end,
    }`
    await lua.doString(composeProjectLua({ manualLua: '', generatedLua }).combinedLua)
    await lua.doString(composeProjectLua({ manualLua: '' }).combinedLua)
    expect(lua.global.get('disposed')).toBe(1)
    expect(lua.global.get('__artcade_logic_runtime')).toBeNull()
    lua.global.close()
  })

  it('keeps the previous runtime active when changed manual code throws', async () => {
    const lua = await new LuaFactory().createEngine()
    await lua.doString('calls = {}; disposed_new = 0')
    const firstGenerated = `local __artcade_logic = {
      initialize = function() end,
      dispose = function() end,
      tick = function() table.insert(calls, "old") end,
    }`
    await lua.doString(composeProjectLua({
      manualLua: 'function tick(dt) table.insert(calls, "user-old") end',
      generatedLua: firstGenerated,
    }).combinedLua)

    const failingGenerated = `local __artcade_logic = {
      initialize = function() end,
      dispose = function() disposed_new = disposed_new + 1 end,
      tick = function() table.insert(calls, "new") end,
    }`
    await expect(lua.doString(composeProjectLua({
      manualLua: 'error("manual failed")',
      generatedLua: failingGenerated,
    }).combinedLua)).rejects.toThrow(/manual failed/)

    ;(lua.global.get('tick') as (dt: number) => void)(1 / 60)
    expect(lua.global.get('calls')).toEqual(['old', 'user-old'])
    expect(lua.global.get('disposed_new')).toBe(1)
    lua.global.close()
  })
})
