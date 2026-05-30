/** Shared Tailwind class fragments for 2026 monochrome UI. */
export const editorBtnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] border text-xs font-medium transition-colors duration-100 select-none'

export const editorBtnDefault =
  `${editorBtnBase} border-[var(--outline)] bg-[var(--surface)] text-[var(--primary)] hover:bg-[var(--outline)]`

export const editorBtnGhost =
  `${editorBtnBase} border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--outline)] hover:text-[var(--primary)]`

export const editorTabBase =
  'px-4 py-2 text-[11px] font-semibold uppercase tracking-wide border-b-2 transition-colors duration-100'

export const editorTabActive =
  'border-[var(--accent)] text-[var(--primary)]'

export const editorTabInactive =
  'border-transparent text-[var(--muted)] hover:text-[var(--primary)]'
