export function LogicBoardScriptConflictBanner({
  onRegenerate,
  onDismiss,
}: {
  onRegenerate: () => void
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-[var(--pill-then-bd)] bg-[var(--pill-then-bg)] text-xs text-[var(--text)]"
    >
      <span className="text-[var(--warn)] font-semibold">Lua diverso dal compilato</span>
      <span className="text-[var(--muted)]">
        Le modifiche manuali non corrispondono alla Logic Board. Rigenera o mantieni il testo attuale.
      </span>
      <span className="flex-1" />
      <button
        type="button"
        onClick={onRegenerate}
        className="px-2.5 py-1 rounded font-semibold border border-[var(--accent-bd)] bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent-bg-h)]"
      >
        Rigenera da board
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="px-2.5 py-1 rounded text-[var(--muted)] hover:text-[var(--text)]"
      >
        Mantieni testo
      </button>
    </div>
  )
}
