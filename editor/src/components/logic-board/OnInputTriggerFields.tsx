// ---------------------------------------------------------------------------
// onInput trigger — primary key, OR/AND/NOT alternates, event type
// ---------------------------------------------------------------------------

import type { LogicTrigger } from '../../types/logic-board'
import type { ConditionCombineOp } from '../../utils/logic-board/condition-combine'
import { getKeyCombine } from '../../utils/logic-board/on-input-keys'
import { ConditionCombineSelect } from './ConditionCombineSelect'
import { KeyCapture, formatKeyLabel } from './KeyCapture'
import { EditorSelect } from '../ui/EditorSelect'

const lbl = 'text-[10px] font-medium text-[var(--muted)]'
const link = 'text-[var(--muted)] text-[11px] underline underline-offset-2 hover:text-[var(--text)] cursor-pointer'
const combineBadge =
  'text-[10px] font-semibold uppercase tracking-wide text-[var(--warn)] px-1'

type OnInputTrigger = Extract<LogicTrigger, { type: 'onInput' }>

function combineHint(combine: ConditionCombineOp): string {
  if (combine === 'AND') {
    return 'Fire when the player holds all keys together (AND), e.g. W and Ctrl.'
  }
  if (combine === 'NOT') {
    return 'Fire when none of these keys match (NOT), e.g. move while Shift is not held.'
  }
  return 'Fire when the player uses any of these keys (OR), e.g. W or Space for jump.'
}

function joinLabel(combine: ConditionCombineOp): string {
  if (combine === 'AND') return 'and'
  if (combine === 'NOT') return 'not'
  return 'or'
}

function keyCombineForAlternates(
  codes: string[],
  combine: ConditionCombineOp,
): ConditionCombineOp | undefined {
  if (codes.length > 0) return combine
  if (combine === 'NOT') return 'NOT'
  return undefined
}

function eventTypeHint(eventType: OnInputTrigger['eventType']): string {
  if (eventType === 'pressed') return 'Edge once per press'
  if (eventType === 'released') return 'Edge once on release'
  return 'Every frame while held'
}

function inputKeysSummary(
  trigger: OnInputTrigger,
  combine: ConditionCombineOp,
  alternates: readonly string[],
): string {
  if (combine === 'NOT' && alternates.length === 0) {
    return `NOT ${formatKeyLabel(trigger.keyCode)}`
  }
  const labels = [trigger.keyCode, ...alternates].map((c) => formatKeyLabel(c))
  if (combine === 'NOT') {
    return `NOT (${labels.join(' or ')})`
  }
  return labels.join(` ${combine} `)
}

export type OnInputTriggerFieldsProps = Readonly<{
  trigger: OnInputTrigger
  onChange: (t: OnInputTrigger) => void
}>

export function OnInputTriggerFields({
  trigger,
  onChange,
}: OnInputTriggerFieldsProps) {
  const alternates = trigger.alternateKeyCodes ?? []
  const combine = getKeyCombine(trigger)
  const joinWord = joinLabel(combine)

  const setAlternates = (codes: string[]) => {
    onChange({
      ...trigger,
      alternateKeyCodes: codes.length > 0 ? codes : undefined,
      keyCombine: keyCombineForAlternates(codes, combine),
    })
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-[10px] leading-snug text-[var(--muted)]">
        {combineHint(combine)} World checks (grounded, score, …) go in{' '}
        <strong>Also require…</strong> with the same AND / OR / NOT menu.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className={lbl}>Key</span>
        <KeyCapture
          value={trigger.keyCode}
          onChange={(keyCode) => onChange({ ...trigger, keyCode })}
        />
        <ConditionCombineSelect
          value={combine}
          aria-label="Combine keys"
          onChange={(op) =>
            onChange({
              ...trigger,
              keyCombine: op,
            })
          }
        />
        {alternates.map((code, i) => (
          <span key={`${code}-${i}`} className="flex items-center gap-2">
            <span className={combineBadge}>{joinWord}</span>
            <KeyCapture
              value={code}
              onChange={(next) => {
                const nextAlt = alternates.slice()
                nextAlt[i] = next
                setAlternates(nextAlt)
              }}
            />
            <button
              type="button"
              className={link}
              onClick={() => setAlternates(alternates.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </span>
        ))}
        <button
          type="button"
          className={link}
          onClick={() => {
            const fallback =
              trigger.keyCode === 'Space' ? 'KeyW' : 'Space'
            const next = [...alternates, fallback]
            onChange({
              ...trigger,
              alternateKeyCodes: next,
              keyCombine: trigger.keyCombine ?? 'OR',
            })
          }}
        >
          + Add key
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={lbl}>When</span>
        <EditorSelect
          className="w-auto"
          triggerClassName="py-1"
          value={trigger.eventType}
          onChange={(eventType) =>
            onChange({
              ...trigger,
              eventType: eventType as OnInputTrigger['eventType'],
            })
          }
          options={[
            { value: 'pressed', label: 'Just pressed' },
            { value: 'down', label: 'Held down' },
            { value: 'released', label: 'Just released' },
          ]}
          aria-label="When"
        />
        <span className="text-[10px] text-[var(--muted)]">
          {eventTypeHint(trigger.eventType)}
        </span>
      </div>
      {(alternates.length > 0 || combine === 'NOT') && (
        <p className="text-[10px] text-[var(--muted)]">
          Summary: {inputKeysSummary(trigger, combine, alternates)}
        </p>
      )}
    </div>
  )
}
