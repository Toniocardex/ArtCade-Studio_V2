// ---------------------------------------------------------------------------
// onInput trigger — primary key + optional OR alternates
// ---------------------------------------------------------------------------

import type { LogicTrigger } from '../../types/logic-board'
import { luaString } from './lua-helpers'

export type OnInputTrigger = Extract<LogicTrigger, { type: 'onInput' }>

/** Unique key codes for this rule (primary first). */
export function getOnInputKeyCodes(trigger: OnInputTrigger): string[] {
  const codes: string[] = []
  const seen = new Set<string>()
  for (const code of [trigger.keyCode, ...(trigger.alternateKeyCodes ?? [])]) {
    if (!code || seen.has(code)) continue
    seen.add(code)
    codes.push(code)
  }
  return codes.length > 0 ? codes : ['Space']
}

/** Lua boolean: any of the keys matches the input edge/state. */
export function onInputGateExpr(trigger: OnInputTrigger): string {
  const fn =
    trigger.eventType === 'pressed'
      ? 'wasKeyPressed'
      : trigger.eventType === 'released'
        ? 'wasKeyReleased'
        : 'isKeyDown'
  const parts = getOnInputKeyCodes(trigger).map(
    (code) => `input.${fn}(${luaString(code)})`,
  )
  if (parts.length === 1) return parts[0]
  return `(${parts.join(' or ')})`
}
