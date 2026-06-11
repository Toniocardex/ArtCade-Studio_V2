// ---------------------------------------------------------------------------
// editor-ui-scale — allowed UI density steps (see docs/ADAPTIVE_LAYOUT.md)
// ---------------------------------------------------------------------------

export const EDITOR_UI_SCALE_STORAGE_KEY = 'artcade.editor-ui-scale-v1'
export const EDITOR_UI_SCALE_SUGGESTION_STORAGE_KEY = 'artcade.editor-ui-scale-suggestion-v1'

/** Ordered scale steps; must stay in sync with VIEW menu and shortcuts. */
export const EDITOR_UI_SCALE_VALUES = [0.75, 0.85, 0.9, 1, 1.15, 1.25] as const

export type EditorUiScale = (typeof EDITOR_UI_SCALE_VALUES)[number]

export const EDITOR_UI_SCALE_DEFAULT: EditorUiScale = 1
