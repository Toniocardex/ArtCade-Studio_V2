// ---------------------------------------------------------------------------
// onInput trigger — primary key, OR/AND alternates, event type
// ---------------------------------------------------------------------------

import type { LogicTrigger } from '../../types/logic-board'
import { getKeyCombine } from '../../utils/logic-board/on-input-keys'
import { KeyCapture, formatKeyLabel } from './KeyCapture'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] font-medium text-[var(--muted)]'
const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'
const combineBadge =
  'text-[10px] font-semibold uppercase tracking-wide text-[var(--warn)] px-1'

type OnInputTrigger = Extract<LogicTrigger, { type: 'onInput' }>

export function OnInputTriggerFields({
  trigger,
  onChange,
}: {
  trigger: OnInputTrigger
  onChange: (t: OnInputTrigger) => void
}) {
  const alternates = trigger.alternateKeyCodes ?? []
  const combine = getKeyCombine(trigger)
  const joinWord = combine === 'AND' ? 'and' : 'or'

  const setAlternates = (codes: string[]) => {
    onChange({
      ...trigger,
      alternateKeyCodes: codes.length > 0 ? codes : undefined,
      keyCombine: codes.length > 0 ? combine : undefined,
    })
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-[10px] leading-snug text-[var(--muted)]">
        {combine === 'AND'
          ? 'Fire when the player presses all keys together (AND), e.g. W and Ctrl for a modifier combo.'
          : 'Fire when the player uses any of these keys (OR), e.g. W or Space for jump.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className={lbl}>Key</span>
        <KeyCapture
          value={trigger.keyCode}
          onChange={(keyCode) => onChange({ ...trigger, keyCode })}
        />
        {alternates.length > 0 && (
          <select
            className={sel}
            value={combine}
            onChange={(e) =>
              onChange({
                ...trigger,
                keyCombine: e.target.value as OnInputTrigger['keyCombine'],
              })
            }
            title="Combine keys with OR or AND"
            aria-label="Combine keys"
          >
            <option value="OR">OR</option>
            <option value="AND">AND</option>
          </select>
        )}
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
      {alternates.length > 0 && (
        <p className="text-[10px] text-[var(--muted)]">
          Summary:{' '}
          {[trigger.keyCode, ...alternates]
            .map((c) => formatKeyLabel(c))
            .join(` ${combine} `)}
        </p>
      )}
    </div>
  )
}
