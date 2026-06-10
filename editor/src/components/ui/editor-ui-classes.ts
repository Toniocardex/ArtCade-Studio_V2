/** Shared Tailwind class fragments for 2026 monochrome UI. */
export const editorBtnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] border text-xs font-medium tracking-normal transition-colors duration-100 select-none'

export const editorBtnDefault =
  `${editorBtnBase} border-[var(--outline-strong)] bg-[var(--surface)] text-[var(--primary)] hover:bg-[var(--surface-hover)]`

export const editorBtnGhost =
  `${editorBtnBase} border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--primary)]`

export const editorTabBase =
  'px-4 py-2 text-[11px] font-semibold tracking-normal border-b transition-colors duration-100'

export const editorTabActive =
  'border-[var(--tab-active-border)] bg-[var(--surface)] text-[var(--text-on-selected)]'

/** List/tree row selection — flat graphite fill, not saturated accent. */
export const editorRowSelected =
  'bg-[var(--surface-selected-strong)] text-[var(--text-on-selected)] font-semibold'

/** Primary toolbar action (Play) — filled accent (mockup v2). */
export const editorToolbarPrimary =
  'border-[var(--accent)] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)]'

/** Filled CTA (explorer + dialogs) — readable label on accent/surface fill. */
export const editorCtaFilled =
  'border-[var(--outline-strong)] bg-[var(--accent-bg)] text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)]'

export const editorTabInactive =
  'border-transparent text-[var(--muted)] hover:text-[var(--primary)]'
