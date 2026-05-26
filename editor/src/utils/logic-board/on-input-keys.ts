// ---------------------------------------------------------------------------
// onInput trigger — primary key + optional alternates (OR or AND)
// ---------------------------------------------------------------------------

import type { LogicTrigger } from '../../types/logic-board'
import { luaString } from './lua-helpers'

export type OnInputTrigger = Extract<LogicTrigger, { type: 'onInput' }>
export type KeyInputCombine = 'OR' | 'AND'

/** How additional keys combine with the primary (default OR). */
export function getKeyCombine(trigger: OnInputTrigger): KeyInputCombine {
  return trigger.keyCombine ?? 'OR'
}

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

/** Keys to register for pressed/released (AND → primary only). */
export function getOnInputRegistrationKeys(trigger: OnInputTrigger): string[] {
  const codes = getOnInputKeyCodes(trigger)
  if (getKeyCombine(trigger) === 'AND' && codes.length > 1) return [codes[0]]
  return codes
}

/** Lua boolean for the full key combo (edge on primary, held on rest when AND). */
export function onInputGateExpr(trigger: OnInputTrigger): string {
  const codes = getOnInputKeyCodes(trigger)
  if (codes.length === 1) {
    const fn =
      trigger.eventType === 'pressed'
        ? 'wasKeyPressed'
        : trigger.eventType === 'released'
          ? 'wasKeyReleased'
          : 'isKeyDown'
    return `input.${fn}(${luaString(codes[0])})`
  }

  const combine = getKeyCombine(trigger)
  if (combine === 'OR') {
    const fn =
      trigger.eventType === 'pressed'
        ? 'wasKeyPressed'
        : trigger.eventType === 'released'
          ? 'wasKeyReleased'
          : 'isKeyDown'
    const parts = codes.map((code) => `input.${fn}(${luaString(code)})`)
    return `(${parts.join(' or ')})`
  }

  const [primary, ...rest] = codes
  const edgeFn =
    trigger.eventType === 'pressed'
      ? 'wasKeyPressed'
      : trigger.eventType === 'released'
        ? 'wasKeyReleased'
        : 'isKeyDown'
  const primaryPart = `input.${edgeFn}(${luaString(primary)})`
  if (rest.length === 0) return primaryPart
  if (trigger.eventType === 'down') {
    const held = codes.map((code) => `input.isKeyDown(${luaString(code)})`)
    return `(${held.join(' and ')})`
  }
  const heldParts = rest.map((code) => `input.isKeyDown(${luaString(code)})`)
  return `(${[primaryPart, ...heldParts].join(' and ')})`
}
