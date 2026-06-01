import { InspectorSection } from './inspector-fields'

const PLACEHOLDER_VARS = [
  { name: 'hp', value: '—' },
  { name: 'isGrounded', value: '—' },
  { name: 'speed', value: '—' },
  { name: 'score', value: '—' },
] as const

/** Mockup-style variable watch (live values require runtime protocol). */
export function VariableWatchSection() {
  return (
    <InspectorSection label="Variable Watch" defaultOpen>
      <p className="text-[9px] text-[var(--muted)] mb-2 leading-snug">
        Live values appear when runtime variable debugging is connected.
      </p>
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="text-[8px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--outline)]">
            <th className="text-left py-1 font-semibold">Name</th>
            <th className="text-right py-1 font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {PLACEHOLDER_VARS.map((row) => (
            <tr key={row.name} className="border-b border-[var(--outline-faint)]">
              <td className="py-1 font-mono text-[var(--primary-soft)]">{row.name}</td>
              <td className="py-1 text-right font-mono text-[var(--muted)]">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </InspectorSection>
  )
}
