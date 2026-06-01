/** Static logic-flow chrome (mockup); real graph when Logic Board exposes a preview API. */
export function LogicBoardPreviewGraph() {
  return (
    <div className="h-full p-2 flex flex-col gap-2 text-[9px]">
      <div className="flex items-center gap-2 flex-wrap">
        <Node label="On Start" />
        <Arrow />
        <Node label="If grounded" muted />
        <Arrow />
        <Node label="Set anim" />
      </div>
      <div className="flex items-center gap-2 pl-6">
        <Arrow />
        <Node label="Else" muted />
        <Arrow />
        <Node label="Idle" />
      </div>
      <p className="text-[var(--muted)] mt-auto leading-snug">
        Select an entity to list real rules in the list view below.
      </p>
    </div>
  )
}

function Node({ label, muted = false }: Readonly<{ label: string; muted?: boolean }>) {
  return (
    <div
      className={`px-2 py-1 rounded border shrink-0 ${
        muted
          ? 'border-[var(--outline)] bg-[var(--surface)] text-[var(--muted)]'
          : 'border-[var(--outline-focus)] bg-[var(--surface-selected)] text-[var(--text-on-selected)]'
      }`}
    >
      {label}
    </div>
  )
}

function Arrow() {
  return <span className="text-[var(--muted)] shrink-0">→</span>
}
