// ---------------------------------------------------------------------------
// Linear action list emission (wait → time.after, repeatTimes → loop / stepped)
// ---------------------------------------------------------------------------

import type { LogicAction } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import { INDENT } from './lua-helpers'
import {
  actionLua,
  REPEAT_TIMES_SENTINEL_PREFIX,
  WAIT_SENTINEL_PREFIX,
} from './action-emitter'
import { repeatIntervalSeconds } from './repeat-interval'

/** Monotonic step names for timed Repeat blocks within one compile scope. */
type RepeatStepSerial = { next: number }

function isSequenceControl(a: LogicAction): boolean {
  return a.type === 'wait' || a.type === 'repeatTimes'
}

function emitPlainAction(
  a: LogicAction,
  indent: string,
  slugs: Map<string, string>,
  project: ProjectDoc | null | undefined,
  lines: string[],
): void {
  const code = actionLua(a, { eventSlugs: slugs, project })
  if (!code) return
  if (code.startsWith(WAIT_SENTINEL_PREFIX)) return
  if (code.startsWith(REPEAT_TIMES_SENTINEL_PREFIX)) return
  lines.push(indent + code)
}

function resolveRepeatBody(
  actions: LogicAction[],
  index: number,
): { body: LogicAction[]; nextIndex: number } {
  const a = actions[index]
  if (a.type !== 'repeatTimes') {
    return { body: [], nextIndex: index + 1 }
  }
  if (a.actions?.length) {
    return { body: a.actions, nextIndex: index + 1 }
  }
  const body: LogicAction[] = []
  let j = index + 1
  while (j < actions.length && !isSequenceControl(actions[j])) {
    body.push(actions[j++])
  }
  return { body, nextIndex: j }
}

function emitRepeatTimes(
  a: Extract<LogicAction, { type: 'repeatTimes' }>,
  actions: LogicAction[],
  index: number,
  indent: string,
  slugs: Map<string, string>,
  project: ProjectDoc | null | undefined,
  lines: string[],
  repeatSerial: RepeatStepSerial,
): number {
  const count = Math.max(1, Math.floor(Number(a.count) || 1))
  const interval = repeatIntervalSeconds(a.intervalSeconds)
  const { body, nextIndex } = resolveRepeatBody(actions, index)

  if (interval <= 0) {
    lines.push(`${indent}for _logic_rep = 1, ${count} do`)
    lines.push(...emitActionSequence(body, indent + INDENT, slugs, project, repeatSerial))
    lines.push(`${indent}end`)
    return nextIndex
  }

  const stepFn = `_logic_rep_step_${++repeatSerial.next}`
  const I = indent + INDENT
  lines.push(`${indent}local function ${stepFn}(n)`)
  lines.push(`${I}if n > ${count} then return end`)
  lines.push(...emitActionSequence(body, I, slugs, project, repeatSerial))
  lines.push(`${I}if n < ${count} then`)
  lines.push(`${I}${INDENT}time.after(${interval}, function() ${stepFn}(n + 1) end)`)
  lines.push(`${I}end`)
  lines.push(`${indent}end`)
  lines.push(`${indent}${stepFn}(1)`)
  return nextIndex
}

export function emitActionSequence(
  actions: LogicAction[],
  indent: string,
  slugs: Map<string, string>,
  project?: ProjectDoc | null,
  repeatSerial: RepeatStepSerial = { next: 0 },
): string[] {
  if (actions.length === 0) return []

  const lines: string[] = []
  let i = 0

  while (i < actions.length) {
    const a = actions[i]

    if (a.type === 'wait') {
      const secs = Number(a.seconds) || 0
      const deferred = [...(a.then ?? []), ...actions.slice(i + 1)]
      const inner = emitActionSequence(deferred, indent + INDENT, slugs, project, repeatSerial)
      lines.push(`${indent}time.after(${secs}, function()`)
      lines.push(...inner)
      lines.push(`${indent}end)`)
      return lines
    }

    if (a.type === 'repeatTimes') {
      i = emitRepeatTimes(a, actions, i, indent, slugs, project, lines, repeatSerial)
      continue
    }

    emitPlainAction(a, indent, slugs, project, lines)
    i++
  }

  return lines
}
