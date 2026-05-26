// ---------------------------------------------------------------------------
// onInput trigger — primary key, OR alternates, event type
// ---------------------------------------------------------------------------

import type { LogicTrigger } from '../../types/logic-board'
import { KeyCapture, formatKeyLabel } from './KeyCapture'

const sel =
  'bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs'
const lbl = 'text-[10px] font-medium text-[var(--muted)]'
const link = 'text-[var(--accent)] text-[11px] hover:underline cursor-pointer'
const orBadge =
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

  const setAlternates = (codes: string[]) => {
    onChange({
      ...trigger,
      alternateKeyCodes: codes.length > 0 ? codes : undefined,
    })
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-[10px] leading-snug text-[var(--muted)]">
        Fire when the player uses any of these keys (OR). Add more keys for
        alternatives like W or Space.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className={lbl}>Key</span>
        <KeyCapture
          value={trigger.keyCode}
          onChange={(keyCode) => onChange({ ...trigger, keyCode })}
        />
        {alternates.map((code, i) => (
          <span key={`${code}-${i}`} className="flex items-center gap-2">
            <span className={orBadge}>or</span>
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
            setAlternates([...alternates, fallback])
          }}
        >
          + Add key (OR)
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
            .join(' OR ')}
        </p>
      )}
    </div>
  )
}
