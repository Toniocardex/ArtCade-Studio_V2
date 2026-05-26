// ---------------------------------------------------------------------------
// Linear action list emission (wait → time.after, repeatTimes → for loop)
// ---------------------------------------------------------------------------

import type { LogicAction } from '../../types/logic-board'
import { INDENT } from './lua-helpers'
import {
  actionLua,
  REPEAT_TIMES_SENTINEL_PREFIX,
  WAIT_SENTINEL_PREFIX,
} from './action-emitter'

function isSequenceControl(a: LogicAction): boolean {
  return a.type === 'wait' || a.type === 'repeatTimes'
}

function emitPlainAction(
  a: LogicAction,
  indent: string,
  slugs: Map<string, string>,
  lines: string[],
): void {
  const code = actionLua(a, { eventSlugs: slugs })
  if (!code) return
  if (code.startsWith(WAIT_SENTINEL_PREFIX)) return
  if (code.startsWith(REPEAT_TIMES_SENTINEL_PREFIX)) return
  lines.push(indent + code)
}

export function emitActionSequence(
  actions: LogicAction[],
  indent: string,
  slugs: Map<string, string>,
): string[] {
  if (actions.length === 0) return []

  const lines: string[] = []
  let i = 0

  while (i < actions.length) {
    const a = actions[i]

    if (a.type === 'wait') {
      const secs = Number(a.seconds) || 0
      const deferred = [...(a.then ?? []), ...actions.slice(i + 1)]
      const inner = emitActionSequence(deferred, indent + INDENT, slugs)
      lines.push(`${indent}time.after(${secs}, function()`)
      lines.push(...inner)
      lines.push(`${indent}end)`)
      return lines
    }

    if (a.type === 'repeatTimes') {
      const count = Math.max(1, Math.floor(Number(a.count) || 1))
      let body: LogicAction[]
      let nextIndex: number
      if (a.actions?.length) {
        body = a.actions
        nextIndex = i + 1
      } else {
        body = []
        let j = i + 1
        while (j < actions.length && !isSequenceControl(actions[j])) {
          body.push(actions[j++])
        }
        nextIndex = j
      }
      lines.push(`${indent}for _logic_rep = 1, ${count} do`)
      lines.push(...emitActionSequence(body, indent + INDENT, slugs))
      lines.push(`${indent}end`)
      i = nextIndex
      continue
    }

    emitPlainAction(a, indent, slugs, lines)
    i++
  }

  return lines
}
