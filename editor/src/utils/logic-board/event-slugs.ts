// ---------------------------------------------------------------------------
// Builds a stable, unique, Lua-identifier-safe slug for every LogicEvent in a
// LogicBoardDoc, derived from the trigger shape. The compiler emits these as a
// `local RULE = { slug = "<eventId>", ... }` table so the generated body can
// reference `_logic_on[RULE.player_holds_d]` instead of `_logic_on["evt_..."]`.
//
// Slugs are an *editor-side cosmetic*: the runtime key in `_logic_on` is still
// the raw `LogicEvent.id`. Renaming a trigger changes its slug but not the id,
// so cross-rule `toggleLogicEvent` references keep working.
// ---------------------------------------------------------------------------

import type { LogicBoardDoc, LogicTrigger } from '../../types/logic-board'
import { getOnInputKeyCodes } from './on-input-keys'

/**
 * Name of the Lua-local table that maps human slugs to raw event ids. Shared
 * between the header builder (which emits `local RULE = {...}`) and
 * ruleKeyExpr (which emits `RULE.<slug>` references) so both stay in lockstep.
 */
export const RULE_TABLE = 'RULE'

function shortKeyLabel(code: string): string {
  // Mirrors the spirit of components/logic-board/KeyCapture.formatKeyLabel but
  // stays inside utils/ to avoid pulling UI layers into the compiler. We only
  // need a stable token, not the user-visible glyph.
  return code.replace(/^Key|^Digit|^Arrow/, '').toLowerCase()
}

function triggerSlugSource(t: LogicTrigger): string {
  switch (t.type) {
    case 'onStart':         return 'on_start'
    case 'onUpdate':        return 'on_update'
    case 'onSpawn':         return 'on_spawn'
    case 'onDestroy':       return 'on_destroy'
    case 'onCollision':     return t.withClass ? `on_collision_${t.withClass}` : 'on_collision'
    case 'onCollisionEnter': return `on_collide_enter_${t.withClass}`
    case 'onCollisionExit':  return `on_collide_exit_${t.withClass}`
    case 'onTriggerEnter':  return t.withClass ? `on_enter_${t.withClass}` : 'on_enter_zone'
    case 'onTriggerExit':   return t.withClass ? `on_exit_${t.withClass}` : 'on_exit_zone'
    case 'onAnimationEnd':  return t.clipName ? `on_anim_end_${t.clipName}` : 'on_anim_end'
    case 'onMessage':       return `on_msg_${t.messageName || 'unnamed'}`
    case 'onTimer':         return t.repeat ? `every_${t.seconds || 0}s` : `after_${t.seconds || 0}s`
    case 'onInput': {
      const verb = t.eventType === 'pressed' ? 'press'
        : t.eventType === 'released' ? 'release' : 'hold'
      const codes = getOnInputKeyCodes(t)
      const sep =
        (t.keyCombine ?? 'OR') === 'AND'
          ? '_and_'
          : (t.keyCombine ?? 'OR') === 'NOT'
            ? '_not_'
            : '_or_'
      const keyPart =
        codes.length > 1
          ? codes.map((c) => shortKeyLabel(c)).join(sep)
          : shortKeyLabel(codes[0] || 'key')
      return `${verb}_${keyPart}`
    }
    case 'onMouseInput': {
      const verb = t.eventType === 'pressed' ? 'click'
        : t.eventType === 'released' ? 'release' : 'hold'
      return `mouse_${verb}_${t.button === 'right' ? 'rmb' : 'lmb'}`
    }
    case 'onObjectClick':
      return `click_object_${t.button === 'right' ? 'rmb' : 'lmb'}`
    case 'onObjectHoverEnter':
      return 'pointer_enter_object'
    case 'onObjectHoverExit':
      return 'pointer_leave_object'
  }
}

function slugify(raw: string): string {
  let out = raw.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!out) out = 'rule'
  if (/^[0-9]/.test(out)) out = `r_${out}`
  // Reserved Lua keywords would shadow as table fields too if we ever switched
  // to `RULE.<slug>` shorthand for non-identifier names. Cheap to prefix.
  const reserved = new Set([
    'and','break','do','else','elseif','end','false','for','function','goto',
    'if','in','local','nil','not','or','repeat','return','then','true','until','while',
  ])
  if (reserved.has(out)) out = `r_${out}`
  return out
}

/** Build id → slug map across every event in the doc; slugs are unique. */
export function buildEventSlugs(doc: LogicBoardDoc): Map<string, string> {
  const used = new Set<string>()
  const map = new Map<string, string>()
  for (const board of doc) {
    for (const ev of board.events) {
      const base = slugify(triggerSlugSource(ev.trigger))
      let s = base
      let n = 2
      while (used.has(s)) s = `${base}_${n++}`
      used.add(s)
      map.set(ev.id, s)
    }
  }
  return map
}

/**
 * Lua expression for the `_logic_on` key of a given event id. Known ids
 * resolve to `RULE.<slug>`; unknown ids (e.g. a stale `toggleLogicEvent`
 * targeting a deleted rule) fall back to the raw quoted id so the script
 * still parses and the toggle stays addressable from the REPL.
 */
export function ruleKeyExpr(
  eventId: string,
  slugs: Map<string, string> | undefined,
): string {
  const slug = slugs?.get(eventId)
  if (slug) return `${RULE_TABLE}.${slug}`
  // luaString-equivalent inline to avoid a circular import with lua-helpers.
  return `"${eventId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
