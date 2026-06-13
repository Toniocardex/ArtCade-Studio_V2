import { luaString } from './logic-board/lua-helpers'

export interface ComposeProjectLuaInput {
  manualLua: string
  generatedLua?: string | null
  projectKey?: string | null
}

export interface ComposedProjectLua {
  manualLua: string
  generatedLua: string
  bootstrapLua: string
  combinedLua: string
}

function stableSourceRevision(source: string): string {
  let hash = 2166136261
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Compose user-owned Lua and virtual Logic Board output into the runtime entry source. */
export function composeProjectLua(input: ComposeProjectLuaInput): ComposedProjectLua {
  const manualLua = input.manualLua
  const generatedLua = input.generatedLua?.trimEnd() ?? ''
  const manualBody = manualLua
  const revision = stableSourceRevision(`${input.projectKey ?? ''}\0${manualLua}`)
  const manualSection = [
    '-- ARTCADE: MY SCRIPT',
    'local __artcade_manual_ok, __artcade_manual_error = pcall(function()',
    `if __artcade_user_source_revision ~= ${luaString(revision)} then`,
    '    rawset(_G, "tick", nil)',
    manualBody,
    '    __artcade_user_tick = rawget(_G, "tick")',
    `    __artcade_user_source_revision = ${luaString(revision)}`,
    'end',
    'end)',
    'if not __artcade_manual_ok then',
    ...(generatedLua ? ['    __artcade_logic.dispose()'] : []),
    '    rawset(_G, "tick", __artcade_previous_tick)',
    '    rawset(_G, "__artcade_user_tick", __artcade_previous_user_tick)',
    '    rawset(_G, "__artcade_user_source_revision", __artcade_previous_user_revision)',
    '    error(__artcade_manual_error, 0)',
    'end',
  ].join('\n')

  const logicSection = generatedLua
    ? [
        '-- ARTCADE: LOGIC BOARD',
        generatedLua,
        '',
        'local __artcade_previous_logic = rawget(_G, "__artcade_logic_runtime")',
        'local __artcade_previous_tick = rawget(_G, "tick")',
        'local __artcade_previous_user_tick = rawget(_G, "__artcade_user_tick")',
        'local __artcade_previous_user_revision = rawget(_G, "__artcade_user_source_revision")',
        'local __artcade_init_ok, __artcade_init_error = pcall(__artcade_logic.initialize)',
        'if not __artcade_init_ok then',
        '    __artcade_logic.dispose()',
        '    error(__artcade_init_error, 0)',
        'end',
      ].join('\n')
    : [
        '-- ARTCADE: LOGIC BOARD',
        'local __artcade_previous_logic = rawget(_G, "__artcade_logic_runtime")',
        'local __artcade_previous_tick = rawget(_G, "tick")',
        'local __artcade_previous_user_tick = rawget(_G, "__artcade_user_tick")',
        'local __artcade_previous_user_revision = rawget(_G, "__artcade_user_source_revision")',
      ].join('\n')

  const bootstrapLua = [
    '-- ARTCADE: BOOTSTRAP',
    'if type(__artcade_previous_logic) == "table" and type(__artcade_previous_logic.dispose) == "function" then',
    '    __artcade_previous_logic.dispose()',
    'end',
    ...(generatedLua
      ? [
          'rawset(_G, "__artcade_logic_runtime", __artcade_logic)',
          'function tick(dt)',
          '    __artcade_logic.tick(dt)',
          '    if __artcade_user_tick then __artcade_user_tick(dt) end',
          'end',
        ]
      : [
          'rawset(_G, "__artcade_logic_runtime", nil)',
          'rawset(_G, "tick", __artcade_user_tick)',
        ]),
  ].join('\n')

  const combinedLua = [
    logicSection,
    '',
    manualSection,
    '',
    bootstrapLua,
    '',
  ].join('\n')

  return { manualLua, generatedLua, bootstrapLua, combinedLua }
}
