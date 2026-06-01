/** Mockup-style event debugger table (live feed deferred). */
export function EventDebuggerTab() {
  const rows = [
    { event: '—', trigger: 'Select an entity', state: 'idle' },
    { event: '—', trigger: 'Open Logic Board for rules', state: 'idle' },
  ] as const

  return (
    <div className="h-full overflow-auto p-2 text-[9px]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[var(--muted)] uppercase tracking-wide text-[8px] border-b border-[var(--outline)]">
            <th className="text-left py-1 pr-1">Event</th>
            <th className="text-left py-1 pr-1">Trigger</th>
            <th className="text-right py-1">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--outline-faint)] text-[var(--primary-soft)]">
              <td className="py-1 pr-1 font-mono">{row.event}</td>
              <td className="py-1 pr-1">{row.trigger}</td>
              <td className="py-1 text-right text-[var(--muted)]">{row.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[var(--muted)] leading-snug">
        Live runtime event stream is planned; this panel mirrors the mockup layout.
      </p>
    </div>
  )
}
