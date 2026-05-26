// ---------------------------------------------------------------------------
// onInput trigger — primary key + optional alternates (OR, AND, or NOT)
// ---------------------------------------------------------------------------

import type { LogicTrigger } from '../../types/logic-board'
import { luaString } from './lua-helpers'

export type OnInputTrigger = Extract<LogicTrigger, { type: 'onInput' }>
export type KeyInputCombine = 'OR' | 'AND' | 'NOT'

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

/** Keys to register for pressed/released (AND/NOT → primary only + gate). */
export function getOnInputRegistrationKeys(trigger: OnInputTrigger): string[] {
  const codes = getOnInputKeyCodes(trigger)
  const combine = getKeyCombine(trigger)
  if ((combine === 'AND' || combine === 'NOT') && codes.length > 1) {
    return [codes[0]]
  }
  return codes
}

/** NOT combos are evaluated in the tick loop (not per-key registration). */
export function onInputUsesPolling(trigger: OnInputTrigger): boolean {
  if (trigger.eventType === 'down') return true
  return getKeyCombine(trigger) === 'NOT' && getOnInputKeyCodes(trigger).length >= 1
}

function inputFn(
  eventType: OnInputTrigger['eventType'],
): 'wasKeyPressed' | 'wasKeyReleased' | 'isKeyDown' {
  return eventType === 'pressed'
    ? 'wasKeyPressed'
    : eventType === 'released'
      ? 'wasKeyReleased'
      : 'isKeyDown'
}

/** Lua boolean for the full key combo (edge on primary, held on rest when AND). */
export function onInputGateExpr(trigger: OnInputTrigger): string {
  const codes = getOnInputKeyCodes(trigger)
  const combine = getKeyCombine(trigger)
  const fn = inputFn(trigger.eventType)

  if (codes.length === 1) {
    const part = `input.${fn}(${luaString(codes[0])})`
    return combine === 'NOT' ? `not (${part})` : part
  }

  if (combine === 'OR') {
    const parts = codes.map((code) => `input.${fn}(${luaString(code)})`)
    return `(${parts.join(' or ')})`
  }

  if (combine === 'NOT') {
    const parts = codes.map((code) => `input.${fn}(${luaString(code)})`)
    return `not (${parts.join(' or ')})`
  }

  const [primary, ...rest] = codes
  const primaryPart = `input.${fn}(${luaString(primary)})`
  if (rest.length === 0) return primaryPart
  if (trigger.eventType === 'down') {
    const held = codes.map((code) => `input.isKeyDown(${luaString(code)})`)
    return `(${held.join(' and ')})`
  }
  const heldParts = rest.map((code) => `input.isKeyDown(${luaString(code)})`)
  return `(${[primaryPart, ...heldParts].join(' and ')})`
}
