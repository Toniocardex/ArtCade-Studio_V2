import type { CollisionFilter, LogicTrigger } from '../../types/logic-board'
import { luaString } from './lua-helpers'

const FILTER_KEYS = ['layer', 'mask', 'role', 'response', 'tag', 'className'] as const

type CollisionFilterKey = (typeof FILTER_KEYS)[number]

export function collisionFilterFromTrigger(
  trig: Extract<
    LogicTrigger,
    | { type: 'onCollision' }
    | { type: 'onCollisionEnter' }
    | { type: 'onCollisionExit' }
    | { type: 'onTriggerEnter' }
    | { type: 'onTriggerExit' }
  >,
): CollisionFilter {
  const filter: CollisionFilter = { ...(trig.filter ?? {}) }
  if (trig.withClass && !filter.className)
    filter.className = trig.withClass
  if ((trig.type === 'onTriggerEnter' || trig.type === 'onTriggerExit') && !filter.response)
    filter.response = 'sensor'
  return filter
}

export function collisionFilterKey(filter: CollisionFilter): string {
  return FILTER_KEYS
    .map((key) => `${key}:${String(filter[key] ?? '')}`)
    .join('|')
}

export function collisionFilterLua(filter: CollisionFilter): string {
  const parts: string[] = []
  for (const key of FILTER_KEYS) {
    const value = filter[key as CollisionFilterKey]
    if (typeof value === 'string' && value.trim().length > 0) {
      parts.push(`${key} = ${luaString(value.trim())}`)
    }
  }
  return `{ ${parts.join(', ')} }`
}

