// ---------------------------------------------------------------------------
// Linear action list emission (including wait → time.after)
// ---------------------------------------------------------------------------

import type { LogicAction } from '../../types/logic-board'
import { INDENT } from './lua-helpers'
import { actionLua, WAIT_SENTINEL_PREFIX } from './action-emitter'

export function emitActionSequence(
  actions: LogicAction[],
  indent: string,
  slugs: Map<string, string>,
): string[] {
  if (actions.length === 0) return []

  const lines: string[] = []
  let i = 0
  const batch: LogicAction[] = []
  while (i < actions.length && actions[i].type !== 'wait') {
    batch.push(actions[i++])
  }
  for (const a of batch) {
    const code = actionLua(a, { eventSlugs: slugs })
    if (!code) continue
    if (code.startsWith(WAIT_SENTINEL_PREFIX)) continue
    lines.push(indent + code)
  }

  if (i >= actions.length) return lines

  const w = actions[i]
  if (w.type !== 'wait') return lines

  const secs = Number(w.seconds) || 0
  const deferred = [...(w.then ?? []), ...actions.slice(i + 1)]
  const inner = emitActionSequence(deferred, indent + INDENT, slugs)

  lines.push(`${indent}time.after(${secs}, function()`)
  lines.push(...inner)
  lines.push(`${indent}end)`)
  return lines
}
