// ---------------------------------------------------------------------------
// onInput trigger — primary key, OR/AND/NOT alternates, event type
// ---------------------------------------------------------------------------

import type { LogicTrigger } from '../../types/logic-board'
import type { ConditionCombineOp } from '../../utils/logic-board/condition-combine'
import { getKeyCombine } from '../../utils/logic-board/on-input-keys'
import { ConditionCombineSelect } from './ConditionCombineSelect'
import { KeyCapture, formatKeyLabel } from './KeyCapture'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] font-medium text-[var(--muted)]'
const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'
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

export function OnInputTriggerFields({
  trigger,
  onChange,
}: {
  trigger: OnInputTrigger
  onChange: (t: OnInputTrigger) => void
}) {
  const alternates = trigger.alternateKeyCodes ?? []
  const combine = getKeyCombine(trigger)
  const joinWord = joinLabel(combine)

  const setAlternates = (codes: string[]) => {
    onChange({
      ...trigger,
      alternateKeyCodes: codes.length > 0 ? codes : undefined,
      keyCombine: codes.length > 0 ? combine : combine === 'NOT' ? 'NOT' : undefined,
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
          className={sel}
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
        <select
          className={sel}
          value={trigger.eventType}
          onChange={(e) =>
            onChange({
              ...trigger,
              eventType: e.target.value as OnInputTrigger['eventType'],
            })
          }
        >
          <option value="pressed">Just pressed</option>
          <option value="down">Held down</option>
          <option value="released">Just released</option>
        </select>
        <span className="text-[10px] text-[var(--muted)]">
          {trigger.eventType === 'pressed'
            ? 'Edge once per press'
            : trigger.eventType === 'released'
              ? 'Edge once on release'
              : 'Every frame while held'}
        </span>
      </div>
      {(alternates.length > 0 || combine === 'NOT') && (
        <p className="text-[10px] text-[var(--muted)]">
          Summary:{' '}
          {combine === 'NOT' && alternates.length === 0
            ? `NOT ${formatKeyLabel(trigger.keyCode)}`
            : combine === 'NOT'
              ? `NOT (${[trigger.keyCode, ...alternates].map((c) => formatKeyLabel(c)).join(' or ')})`
              : [trigger.keyCode, ...alternates]
                  .map((c) => formatKeyLabel(c))
                  .join(` ${combine} `)}
        </p>
      )}
    </div>
  )
}
